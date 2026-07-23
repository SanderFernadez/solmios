// compras/usecases/orders.ts — Órdenes de compra (COM-2). Desde una requisición aprobada o directa.
// Totales calculados por el server; impuesto desde configuration (NO hardcode); moneda del hotel.
// Ciclo: draft → sent → received | closed | cancelled. El proveedor se valida vía puerto (connector treasury).
import type { RepositoryAdapter, Auth } from 'arckode-framework'
import { NotFoundError, ValidationError, ConflictError } from 'arckode-framework'
import type { PurchaseOrderDTO, PurchaseOrderItemDTO, PurchaseOrderStatus, ComprasPorts, CurrentUser } from '../types'
import { nextNumber } from './number'

export interface OrdersDeps {
  orders: RepositoryAdapter<PurchaseOrderDTO>
  orderItems: RepositoryAdapter<PurchaseOrderItemDTO>
  requisitions: RepositoryAdapter<any>
  reqItems: RepositoryAdapter<any>
  config: RepositoryAdapter<any>
  hotels: RepositoryAdapter<any>
  userRepo: RepositoryAdapter<any>
  auth: Auth
  ports: ComprasPorts
}

export interface OrderLineInput { inventoryItemId?: string; description: string; quantity?: number; unit?: string; unitPrice?: number; taxRate?: number }
export interface CreateOrderInput { supplierId?: string; requisitionId?: string; expectedDate?: string; notes?: string; items?: OrderLineInput[] }

const round2 = (n: number): number => Math.round((Number(n) || 0) * 100) / 100
function hotelOf(u: CurrentUser): string { const h = u.hotelId || ''; if (!h) throw new ValidationError('Sin hotel asignado'); return h }

/** Tasa de impuesto del hotel (%). De configuration('taxes') (array de tasas) → fallback hotels.taxRate → 0. */
async function hotelTaxRate(config: RepositoryAdapter<any>, hotels: RepositoryAdapter<any>, hotelId: string): Promise<number> {
  try {
    const cfg = await config.findOne({ hotelId, key: 'taxes' })
    const val = (cfg as any)?.value
    if (Array.isArray(val) && val.length) {
      const r = Number(val[0]?.rate ?? val[0]?.percentage ?? val[0])
      if (Number.isFinite(r) && r >= 0) return r
    }
  } catch { /* sigue al fallback */ }
  const hotel = await hotels.findOne({ id: hotelId })
  const r = Number((hotel as any)?.taxRate)
  return Number.isFinite(r) && r >= 0 ? r : 0
}

async function loadOwned(deps: OrdersDeps, id: string, user: CurrentUser): Promise<PurchaseOrderDTO> {
  const order = await deps.orders.findById(id)
  if (!order) throw new NotFoundError('Orden de compra no encontrada')
  const me = await deps.userRepo.findById(user.id)
  deps.auth.assertOwnership(order.hotelId, (me as any)?.hotelId ?? '', user.role, 'super_admin')
  return order
}

async function recompute(deps: OrdersDeps, order: PurchaseOrderDTO): Promise<PurchaseOrderDTO> {
  const items = (await deps.orderItems.findMany({ orderId: order.id })) as PurchaseOrderItemDTO[]
  let subtotal = 0, tax = 0
  for (const l of items) {
    const line = round2(Number(l.quantity) * Number(l.unitPrice))
    subtotal += line
    tax += round2(line * (Number(l.taxRate) || 0) / 100)
  }
  subtotal = round2(subtotal); tax = round2(tax)
  const total = round2(subtotal + tax)
  const updated = await deps.orders.update(order.id, { subtotal, tax, total } as any)
  return (updated as PurchaseOrderDTO) ?? { ...order, subtotal, tax, total }
}

async function validateSupplier(deps: OrdersDeps, supplierId: string | undefined, hotelId: string): Promise<void> {
  if (!supplierId) return
  if (deps.ports.supplierExists) {
    const ok = await deps.ports.supplierExists(supplierId, hotelId)
    if (!ok) throw new ValidationError('El proveedor no existe')
  }
}

export async function listOrders(deps: OrdersDeps, query: { status?: string; supplierId?: string } | undefined, user: CurrentUser): Promise<{ data: PurchaseOrderDTO[]; total: number }> {
  const hotelId = hotelOf(user)
  const filters: any = { hotelId }
  if (query?.status) filters.status = query.status
  if (query?.supplierId) filters.supplierId = query.supplierId
  const data = (await deps.orders.findMany(filters)) as PurchaseOrderDTO[]
  data.sort((a, b) => String(b.createdAt || '').localeCompare(String(a.createdAt || '')))
  return { data, total: data.length }
}

export async function getOrder(deps: OrdersDeps, id: string, user: CurrentUser): Promise<PurchaseOrderDTO & { items: PurchaseOrderItemDTO[] }> {
  const order = await loadOwned(deps, id, user)
  const items = (await deps.orderItems.findMany({ orderId: id })) as PurchaseOrderItemDTO[]
  return { ...order, items }
}

async function buildLine(deps: OrdersDeps, hotelId: string, orderId: string, l: OrderLineInput, defTax: number): Promise<Omit<PurchaseOrderItemDTO, 'id'>> {
  if (!l.description?.trim()) throw new ValidationError('Cada línea necesita una descripción')
  const qty = Number(l.quantity ?? 1)
  if (!Number.isFinite(qty) || qty <= 0) throw new ValidationError('La cantidad debe ser > 0')
  const unitPrice = Number(l.unitPrice ?? 0)
  if (!Number.isFinite(unitPrice) || unitPrice < 0) throw new ValidationError('El precio unitario debe ser ≥ 0')
  const taxRate = l.taxRate !== undefined ? Number(l.taxRate) : defTax
  return {
    hotelId, orderId, inventoryItemId: l.inventoryItemId || undefined, description: l.description.trim(),
    quantity: qty, unit: l.unit?.trim() || 'unit', unitPrice: round2(unitPrice),
    taxRate: Number.isFinite(taxRate) && taxRate >= 0 ? taxRate : 0,
    lineTotal: round2(qty * unitPrice), receivedQty: 0,
  } as Omit<PurchaseOrderItemDTO, 'id'>
}

export async function createOrder(deps: OrdersDeps, dto: CreateOrderInput, user: CurrentUser): Promise<PurchaseOrderDTO & { items: PurchaseOrderItemDTO[] }> {
  const hotelId = hotelOf(user)
  await validateSupplier(deps, dto.supplierId, hotelId)
  const number = await nextNumber(deps.config, hotelId, 'OC', 'order')
  const hotel = await deps.hotels.findOne({ id: hotelId })
  const currency = (hotel as any)?.currency || undefined
  const defTax = await hotelTaxRate(deps.config, deps.hotels, hotelId)

  // Si viene de una requisición aprobada y no se pasan líneas, se copian las de la requisición.
  let lines = dto.items ?? []
  if (dto.requisitionId && !lines.length) {
    const req = await deps.requisitions.findById(dto.requisitionId)
    if (req && req.hotelId === hotelId && req.status === 'approved') {
      const reqLines = (await deps.reqItems.findMany({ requisitionId: dto.requisitionId })) as any[]
      lines = reqLines.map((r) => ({ inventoryItemId: r.inventoryItemId, description: r.description, quantity: r.quantity, unit: r.unit }))
    }
  }

  const order = await deps.orders.create({
    hotelId, number, requisitionId: dto.requisitionId || undefined, supplierId: dto.supplierId || undefined,
    status: 'draft', subtotal: 0, tax: 0, total: 0, currency, expectedDate: dto.expectedDate, notes: dto.notes,
  } as Omit<PurchaseOrderDTO, 'id'>)

  const items: PurchaseOrderItemDTO[] = []
  for (const l of lines) items.push(await deps.orderItems.create(await buildLine(deps, hotelId, order.id, l, defTax)))
  const fresh = await recompute(deps, order)
  return { ...fresh, items }
}

export async function addLine(deps: OrdersDeps, id: string, l: OrderLineInput, user: CurrentUser): Promise<PurchaseOrderItemDTO> {
  const order = await loadOwned(deps, id, user)
  if (order.status !== 'draft') throw new ConflictError('La orden ya no está en borrador')
  const defTax = await hotelTaxRate(deps.config, deps.hotels, order.hotelId)
  const line = await deps.orderItems.create(await buildLine(deps, order.hotelId, order.id, l, defTax))
  await recompute(deps, order)
  return line
}

export async function removeLine(deps: OrdersDeps, id: string, lineId: string, user: CurrentUser): Promise<void> {
  const order = await loadOwned(deps, id, user)
  if (order.status !== 'draft') throw new ConflictError('La orden ya no está en borrador')
  const line = await deps.orderItems.findOne({ id: lineId })
  if (!line || line.orderId !== id) throw new NotFoundError('Línea no encontrada')
  await deps.orderItems.delete(lineId)
  await recompute(deps, order)
}

const TRANSITIONS: Record<PurchaseOrderStatus, PurchaseOrderStatus[]> = {
  draft: ['sent', 'cancelled'],
  sent: ['received', 'closed', 'cancelled'],
  received: ['closed'],
  closed: [],
  cancelled: [],
}

export async function transition(deps: OrdersDeps, id: string, to: PurchaseOrderStatus, user: CurrentUser): Promise<PurchaseOrderDTO> {
  const order = await loadOwned(deps, id, user)
  if (!TRANSITIONS[order.status]?.includes(to)) throw new ConflictError(`Transición inválida: ${order.status} → ${to}`)
  if (to === 'sent') {
    const items = await deps.orderItems.findMany({ orderId: id })
    if (!items.length) throw new ValidationError('La orden no tiene líneas')
  }
  const updated = await deps.orders.update(id, { status: to } as any)
  if (!updated) throw new NotFoundError('Orden de compra no encontrada')
  return updated
}
