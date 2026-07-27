// restaurant/usecases/settlement.ts — Cuenta y cobro de la comanda (RES-5).
// Dos vías MUTUAMENTE EXCLUYENTES: cargo a la habitación (folio) XOR cobro directo (payment). Una
// venta se cuenta UNA sola vez. El POS no mueve plata: delega en folios/payments vía puertos que
// inyecta un conector (setSettlementDeps). Ver specs/billing-payment.md + design.md.
import type { RepositoryAdapter, Auth } from 'arckode-framework'
import { NotFoundError, ValidationError, ConflictError } from 'arckode-framework'
import type { OrderDTO, OrderItemDTO, TableDTO, CurrentUser } from '../types'
import type { RestaurantSockets } from '../sockets'
import { recomputeTotals, round2 } from './order-totals'

// Puertos que provee el conector (folios/payments). El módulo NO importa esos módulos.
export interface ChargeToFolioInput { hotelId: string; reservationId: string; guestId?: string; roomId?: string; description: string; amount: number; quantity: number }
export interface RecordPaymentInput { hotelId: string; method: string; amount: number; description: string; folioId?: string; currency?: string }
export interface SettlementPorts {
  chargeToFolio?: (input: ChargeToFolioInput, user: CurrentUser) => Promise<{ folioId: string }>
  recordPayment?: (input: RecordPaymentInput, user: CurrentUser) => Promise<{ paymentId: string }>
  refundPayment?: (input: { paymentId: string }, user: CurrentUser) => Promise<void>
}

export interface SettlementDeps {
  orders: RepositoryAdapter<OrderDTO>
  lines: RepositoryAdapter<OrderItemDTO>
  tables: RepositoryAdapter<TableDTO>
  hotels: RepositoryAdapter<any>
  userRepo: RepositoryAdapter<any>
  auth: Auth
  sockets: RestaurantSockets
  ports: SettlementPorts
}

// Una comanda ya liquidada — o CANCELADA — no se liquida.
function assertSettleable(order: OrderDTO): void {
  // A1 (QA): sin este guard, una comanda `cancelled` (que NO cancela sus líneas) se podía cobrar/cargar
  // al folio → dinero por una venta anulada.
  if (order.status === 'cancelled') throw new ConflictError('La comanda está cancelada')
  if (order.settlement || order.status === 'charged' || order.status === 'paid') {
    throw new ConflictError('La comanda ya fue liquidada')
  }
}

/** Carga la comanda validando ownership (findById + assertOwnership inline en el mismo scope). */
export async function loadOrder(deps: SettlementDeps, id: string, user: CurrentUser): Promise<OrderDTO> {
  const order = await deps.orders.findById(id)
  if (!order) throw new NotFoundError('Comanda no encontrada')
  const me = await deps.userRepo.findById(user.id)
  deps.auth.assertOwnership(order.hotelId, (me as any)?.hotelId ?? '', user.role, 'super_admin')
  return order
}

async function freeTable(deps: SettlementDeps, order: OrderDTO): Promise<void> {
  if (order.tableId) await deps.tables.update(order.tableId, { status: 'free' } as Partial<Omit<TableDTO, 'id'>>)
}

/** Calcula la cuenta: recomputa subtotal/tax y fija la propina. Deja la comanda en `billed`. */
export async function billOrder(deps: SettlementDeps, id: string, dto: { tip?: number }, user: CurrentUser): Promise<OrderDTO> {
  const order = await loadOrder(deps, id, user)
  assertSettleable(order)
  const tip = round2(Number(dto.tip ?? order.tip ?? 0))
  if (!Number.isFinite(tip) || tip < 0) throw new ValidationError('La propina debe ser ≥ 0')
  await deps.orders.update(id, { tip, status: 'billed' } as Partial<Omit<OrderDTO, 'id'>>)
  return recomputeTotals(deps, { ...order, tip, status: 'billed' })
}

/**
 * Carga la comanda a la habitación del huésped (folio). Postea el SUBTOTAL NETO: el folio aplica su
 * propio impuesto (como todo room-charge) → no se dobla el ITBIS. La propina NO se transfiere al folio
 * (solo aplica al cobro directo). Deja la comanda en `charged` y libera la mesa.
 */
export async function chargeToRoom(deps: SettlementDeps, id: string, dto: { reservationId?: string }, user: CurrentUser): Promise<OrderDTO> {
  const order = await loadOrder(deps, id, user)
  assertSettleable(order)
  const reservationId = dto.reservationId || order.reservationId
  if (!reservationId) throw new ValidationError('La comanda no tiene reserva asociada; solo cabe el cobro directo')
  if (!deps.ports.chargeToFolio) throw new ValidationError('Cargo a habitación no disponible (folios no conectado)')

  const fresh = await recomputeTotals(deps, order)
  // M2 (QA): el folio no transfiere la propina; en vez de perderla en silencio, se rechaza. La propina
  // se cobra directo (efectivo/tarjeta), no se carga a la habitación.
  if (Number(fresh.tip || 0) > 0) throw new ValidationError('La comanda tiene propina: el cargo a habitación no la transfiere. Cobrá directo o quitá la propina.')
  const amount = round2(Number(fresh.subtotal || 0))   // neto; el folio le aplica el impuesto
  if (amount <= 0) throw new ValidationError('La comanda no tiene consumos para cargar')

  // M1 (QA, deuda documentada): el cargo al folio ocurre ANTES del update de la comanda (misma
  // convención que folios/applyPayment: "el dinero primero"). Si el update fallara tras un postCharge
  // exitoso, un reintento duplicaría el cargo. Aceptado para RES-5; un fix robusto requiere idempotency
  // key en postCharge. Ver deudas técnicas.
  const res = await deps.ports.chargeToFolio({
    hotelId: order.hotelId, reservationId, guestId: order.guestId, roomId: order.roomId,
    description: `Restaurante · comanda ${order.number ?? id}`, amount, quantity: 1,
  }, user)

  const updated = (await deps.orders.update(id, {
    status: 'charged', settlement: 'folio', folioId: res.folioId,
    reservationId, closedAt: new Date().toISOString(),
  } as Partial<Omit<OrderDTO, 'id'>>)) as OrderDTO
  await freeTable(deps, order)
  await deps.sockets.onOrderCharged?.(updated)
  return updated
}

/**
 * Cobra la comanda directo (efectivo/tarjeta). Crea un payment por el TOTAL BRUTO (subtotal + tax +
 * propina). El asiento de caja lo hace payments; el ingreso "Ventas Restaurante" lo reconoce el
 * conector de contabilidad (RES-6) al escuchar onOrderPaid. Deja la comanda en `paid` y libera la mesa.
 */
export async function payOrder(deps: SettlementDeps, id: string, dto: { method: string }, user: CurrentUser): Promise<OrderDTO> {
  const order = await loadOrder(deps, id, user)
  assertSettleable(order)
  if (!dto.method) throw new ValidationError('El método de cobro es obligatorio')
  if (!deps.ports.recordPayment) throw new ValidationError('Cobro directo no disponible (payments no conectado)')

  const fresh = await recomputeTotals(deps, order)
  const amount = round2(Number(fresh.total || 0))   // bruto: incluye impuesto y propina
  if (amount <= 0) throw new ValidationError('La comanda no tiene monto para cobrar')

  // M3 (QA): la moneda sale del hotel (no default USD). findOne (no findById): el hotelId ya está
  // validado por loadOrder; solo releo ESE hotel para su moneda. Si el hotel no la define, payments defaultea.
  const hotel = await deps.hotels.findOne({ id: order.hotelId })
  const currency = (hotel as any)?.currency || undefined

  // M1 (QA, deuda documentada): el payment se crea ANTES del update de la comanda ("el dinero primero",
  // misma convención del sistema). Si el update fallara tras un payment completed, un reintento duplicaría
  // el cobro. Aceptado para RES-5; fix robusto = idempotency key en createPayment.
  const res = await deps.ports.recordPayment({
    hotelId: order.hotelId, method: dto.method, amount, currency,
    description: `Restaurante · comanda ${order.number ?? id}`,
  }, user)

  const updated = (await deps.orders.update(id, {
    status: 'paid', settlement: 'payment', paymentId: res.paymentId,
    closedAt: new Date().toISOString(),
  } as Partial<Omit<OrderDTO, 'id'>>)) as OrderDTO
  await freeTable(deps, order)
  await deps.sockets.onOrderPaid?.(updated)
  return updated
}

/**
 * Reembolsa una comanda cobrada con tarjeta (settlement='payment'). Delega la devolución del dinero
 * en payments vía `ports.refundPayment` (idempotente por paymentId del lado del gateway). v1 solo
 * reembolsa cobros directos con tarjeta: el cargo a folio (settlement='folio') no tiene reversión
 * aquí (deuda documentada). El inventario y la contabilidad se reversan por sockets (conectores).
 * Idempotente por estado: una segunda llamada sobre la misma orden ya `refunded` devuelve sin repetir
 * el port ni el socket (guard anti-reentrada).
 */
export async function refundOrder(deps: SettlementDeps, id: string, user: CurrentUser): Promise<OrderDTO> {
  const order = await loadOrder(deps, id, user)
  // Idempotencia por estado: ya reembolsada → no-op (no duplica port ni socket).
  if (order.status === 'refunded') return order
  // Solo se puede reembolsar una orden cobrada directo con tarjeta. Folio (cargo a habitación) y
  // cash quedan fuera de v1 (ver deudas: reversal de folio requiere credit-note; cash no tiene gateway).
  if (order.status !== 'paid' || order.settlement !== 'payment') {
    throw new ConflictError('Solo se puede reembolsar una orden cobrada con tarjeta')
  }
  if (!order.paymentId) throw new ValidationError('La comanda no tiene payment asociado')
  if (!deps.ports.refundPayment) throw new ValidationError('Reembolso no disponible (payments no conectado)')

  // M1 (QA, deuda documentada): el refund del payment se llama ANTES del update de la comanda
  // ("el dinero primero", misma convención que payOrder/chargeToRoom). Si el update fallara tras un
  // refund exitoso, un reintento encontraría la orden aún `paid` y repetiría el refund. Aceptado: el
  // refund de gateway es idempotente por paymentId (stripe); un fix robusto = idempotency key propia.
  await deps.ports.refundPayment({ paymentId: order.paymentId }, user)

  const updated = (await deps.orders.update(id, {
    status: 'refunded',
    closedAt: new Date().toISOString(),
  } as Partial<Omit<OrderDTO, 'id'>>)) as OrderDTO
  await deps.sockets.onOrderRefunded?.(updated)
  return updated
}
