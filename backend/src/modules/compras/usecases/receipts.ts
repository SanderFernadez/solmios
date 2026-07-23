// compras/usecases/receipts.ts — Recepción de mercancía (COM-3) + facturación → gasto (COM-4).
// La recepción suma stock al inventario vía puerto (connector, NO importa inventario). Idempotente por
// receiptItemId. La OC pasa a `received` cuando todo lo pedido llegó. Facturar genera UN gasto (dedup).
import type { RepositoryAdapter, Auth } from 'arckode-framework'
import { NotFoundError, ValidationError, ConflictError } from 'arckode-framework'
import type { PurchaseOrderDTO, PurchaseOrderItemDTO, GoodsReceiptDTO, ReceiptItemDTO, ComprasPorts, CurrentUser } from '../types'
import { nextNumber } from './number'

export interface ReceiptsDeps {
  orders: RepositoryAdapter<PurchaseOrderDTO>
  orderItems: RepositoryAdapter<PurchaseOrderItemDTO>
  receipts: RepositoryAdapter<GoodsReceiptDTO>
  receiptItems: RepositoryAdapter<ReceiptItemDTO>
  config: RepositoryAdapter<any>
  userRepo: RepositoryAdapter<any>
  auth: Auth
  ports: ComprasPorts
}

const round4 = (n: number): number => Math.round((Number(n) || 0) * 10000) / 10000
function hotelOf(u: CurrentUser): string { const h = u.hotelId || ''; if (!h) throw new ValidationError('Sin hotel asignado'); return h }

export interface ReceiveLineInput { orderItemId: string; quantity: number }
export interface ReceiveInput { notes?: string; lines: ReceiveLineInput[] }

async function loadOrder(deps: ReceiptsDeps, id: string, user: CurrentUser): Promise<PurchaseOrderDTO> {
  const order = await deps.orders.findById(id)
  if (!order) throw new NotFoundError('Orden de compra no encontrada')
  const me = await deps.userRepo.findById(user.id)
  deps.auth.assertOwnership(order.hotelId, (me as any)?.hotelId ?? '', user.role, 'super_admin')
  return order
}

/** Recibe (total o parcial) contra una OC. Suma receivedQty por línea (≤ pendiente) y stock al inventario. */
export async function receive(deps: ReceiptsDeps, orderId: string, dto: ReceiveInput, user: CurrentUser): Promise<GoodsReceiptDTO & { lines: ReceiptItemDTO[] }> {
  const hotelId = hotelOf(user)
  const order = await loadOrder(deps, orderId, user)
  if (order.status !== 'sent') throw new ConflictError('Solo se recibe una orden enviada (sent)')
  if (!dto.lines?.length) throw new ValidationError('La recepción no tiene líneas')

  const orderItems = (await deps.orderItems.findMany({ orderId })) as PurchaseOrderItemDTO[]
  const byId = new Map(orderItems.map((i) => [i.id, i]))

  // Validar cantidades ANTES de escribir nada (≤ pendiente y > 0).
  for (const l of dto.lines) {
    const oi = byId.get(l.orderItemId)
    if (!oi) throw new ValidationError('Línea de OC inválida')
    const qty = Number(l.quantity)
    if (!Number.isFinite(qty) || qty <= 0) throw new ValidationError('Cantidad recibida inválida')
    const pending = Number(oi.quantity) - Number(oi.receivedQty || 0)
    if (qty > pending + 1e-9) throw new ValidationError(`Se recibe más de lo pendiente (${pending}) en "${oi.description}"`)
  }

  const number = await nextNumber(deps.config, hotelId, 'REC', 'receipt')
  const receipt = await deps.receipts.create({ hotelId, number, orderId, receivedBy: user.id, notes: dto.notes } as Omit<GoodsReceiptDTO, 'id'>)

  const lines: ReceiptItemDTO[] = []
  for (const l of dto.lines) {
    const oi = byId.get(l.orderItemId)!
    const qty = round4(Number(l.quantity))
    const ri = await deps.receiptItems.create({
      hotelId, receiptId: receipt.id, orderItemId: oi.id, inventoryItemId: oi.inventoryItemId,
      quantity: qty, unitCost: round4(Number(oi.unitPrice) || 0),
    } as Omit<ReceiptItemDTO, 'id'>)
    lines.push(ri)
    // Actualizar lo recibido en la línea de OC.
    await deps.orderItems.update(oi.id, { receivedQty: round4(Number(oi.receivedQty || 0) + qty) } as any)
    // Sumar stock al inventario (idempotente por receiptItemId). Best-effort: si el inventario no está
    // disponible, la recepción NO falla (el stock se puede reconciliar; la OC ya registró la recepción).
    if (oi.inventoryItemId && deps.ports.addStock) {
      try {
        await deps.ports.addStock({ itemId: oi.inventoryItemId, quantity: qty, unitCost: Number(oi.unitPrice) || 0, sourceId: ri.id }, user)
      } catch { /* best-effort */ }
    }
  }

  // Si todas las líneas están completas, la OC pasa a `received`.
  const fresh = (await deps.orderItems.findMany({ orderId })) as PurchaseOrderItemDTO[]
  const allReceived = fresh.every((i) => Number(i.receivedQty || 0) >= Number(i.quantity) - 1e-9)
  if (allReceived) await deps.orders.update(orderId, { status: 'received' } as any)

  return { ...receipt, lines }
}

export async function listReceipts(deps: ReceiptsDeps, orderId: string, user: CurrentUser): Promise<{ data: GoodsReceiptDTO[]; total: number }> {
  await loadOrder(deps, orderId, user)
  const data = (await deps.receipts.findMany({ orderId })) as GoodsReceiptDTO[]
  data.sort((a, b) => String(b.createdAt || '').localeCompare(String(a.createdAt || '')))
  return { data, total: data.length }
}

/**
 * Marca la OC como facturada por el proveedor y genera UN gasto (via puerto → connector gastos), que ya
 * pega en caja + contabilidad. Idempotente: si la OC ya tiene expenseId, no crea otro (dedup).
 */
export async function markInvoiced(deps: ReceiptsDeps, orderId: string, dto: { invoiceNumber?: string }, user: CurrentUser): Promise<PurchaseOrderDTO> {
  const order = await loadOrder(deps, orderId, user)
  if (order.status === 'cancelled' || order.status === 'draft') throw new ConflictError('La orden no está en un estado facturable')
  if (order.expenseId) return order   // ya facturada (dedup): NO crear otro gasto
  if (Number(order.total) <= 0) throw new ValidationError('La orden no tiene monto para facturar')
  if (!deps.ports.createExpenseFromPO) throw new ValidationError('Facturación no disponible (gastos no conectado)')

  const { expenseId } = await deps.ports.createExpenseFromPO({
    orderId: order.id, supplierId: order.supplierId, amount: Number(order.total),
    invoiceNumber: dto.invoiceNumber, currency: order.currency,
  }, user)

  const updated = await deps.orders.update(orderId, {
    invoiceNumber: dto.invoiceNumber || order.invoiceNumber, expenseId,
    status: order.status === 'received' ? 'closed' : order.status,
  } as any)
  if (!updated) throw new NotFoundError('Orden de compra no encontrada')
  return updated
}
