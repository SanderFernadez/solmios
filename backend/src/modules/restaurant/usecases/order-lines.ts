// restaurant/usecases/order-lines.ts — Líneas de la comanda (RES-3): agregar, editar, quitar.
// Cada línea SNAPSHOTEA name/unitPrice/taxRate/estación al crearse (la comanda no muta si cambia la
// carta después). Los totales se recalculan en el server tras cada cambio. hotelId SIEMPRE del JWT.
import type { RepositoryAdapter, Auth } from 'arckode-framework'
import { NotFoundError, ValidationError, ConflictError } from 'arckode-framework'
import type { OrderDTO, OrderItemDTO, MenuItemDTO, CategoryDTO, StationDTO, CurrentUser } from '../types'
import { resolveStation, recomputeTotals, round2 } from './order-totals'

export interface OrderLinesDeps {
  orders: RepositoryAdapter<OrderDTO>
  lines: RepositoryAdapter<OrderItemDTO>
  items: RepositoryAdapter<MenuItemDTO>
  categories: RepositoryAdapter<CategoryDTO>
  stations: RepositoryAdapter<StationDTO>
  config: RepositoryAdapter<any>
  hotels: RepositoryAdapter<any>
  userRepo: RepositoryAdapter<any>
  auth: Auth
}

// Una vez liquidada o cancelada, la comanda no acepta cambios de líneas.
const LINES_LOCKED: OrderDTO['status'][] = ['charged', 'paid', 'cancelled']

export interface AddLineInput { menuItemId: string; quantity?: number; notes?: string }
export interface UpdateLineInput { quantity?: number; notes?: string }

/**
 * Tasa de impuesto (%) del hotel — copia local (el codebase duplica taxRateFor por módulo en vez de
 * cross-importar; ver folios/folio-math.ts y facturas/billing.ts). `configuration(key='taxes')` o
 * fallback a `hotels.taxRate`. NO hardcodeado.
 */
async function hotelTaxRate(config: RepositoryAdapter<any>, hotels: RepositoryAdapter<any>, hotelId: string): Promise<number> {
  try {
    let c = await config.findOne({ hotelId, key: 'taxes' })
    if (!c) c = await config.findOne({ hotelId, key: 'impuestos' })
    const arr: any[] = c?.value ?? []
    const configured = arr.filter((t) => t && (t.activo ?? t.active)).reduce((s, t) => s + Number(t.tasa ?? t.rate ?? 0), 0)
    if (configured > 0) return configured
  } catch { /* cae al fallback */ }
  try {
    const hotel = await hotels.findById(hotelId)
    return Number((hotel as any)?.taxRate) || 0
  } catch { return 0 }
}

async function loadOrderForEdit(deps: OrderLinesDeps, orderId: string, user: CurrentUser): Promise<OrderDTO> {
  const order = await deps.orders.findById(orderId)
  if (!order) throw new NotFoundError('Comanda no encontrada')
  const me = await deps.userRepo.findById(user.id)
  deps.auth.assertOwnership(order.hotelId, (me as any)?.hotelId ?? '', user.role, 'super_admin')
  if (LINES_LOCKED.includes(order.status)) throw new ConflictError(`La comanda está ${order.status}; no admite cambios`)
  return order
}

function assertQuantity(q: number | undefined): number {
  const n = Number(q ?? 1)
  if (!Number.isInteger(n) || n < 1) throw new ValidationError('La cantidad debe ser un entero ≥ 1')
  return n
}

export async function addLine(deps: OrderLinesDeps, orderId: string, dto: AddLineInput, user: CurrentUser): Promise<OrderItemDTO> {
  const order = await loadOrderForEdit(deps, orderId, user)
  const item = await deps.items.findOne({ id: dto.menuItemId })
  if (!item || item.hotelId !== order.hotelId) throw new ValidationError('El ítem no existe o es de otro hotel')
  if ((item.available ?? 1) === 0) throw new ValidationError(`"${item.name}" no está disponible`)
  const quantity = assertQuantity(dto.quantity)
  const unitPrice = Number(item.price || 0)
  const taxRate = item.taxRate ?? await hotelTaxRate(deps.config, deps.hotels, order.hotelId)
  const station = await resolveStation(deps, item, order.hotelId)
  const line = await deps.lines.create({
    hotelId: order.hotelId,
    orderId,
    menuItemId: item.id,
    name: item.name,               // snapshot
    unitPrice,                     // snapshot (neto)
    quantity,
    notes: dto.notes,
    taxRate,                       // snapshot de la tasa (%)
    stationId: station.stationId,
    stationName: station.stationName,
    status: 'new',
    lineTotal: round2(unitPrice * quantity),
  } as Omit<OrderItemDTO, 'id'>)
  await recomputeTotals(deps, order)
  return line
}

export async function updateLine(deps: OrderLinesDeps, orderId: string, lineId: string, dto: UpdateLineInput, user: CurrentUser): Promise<OrderItemDTO> {
  const order = await loadOrderForEdit(deps, orderId, user)
  // findOne (no findById): la línea se valida por orderId+hotelId; el ownership ya lo hizo loadOrderForEdit.
  const line = await deps.lines.findOne({ id: lineId })
  if (!line || line.orderId !== orderId || line.hotelId !== order.hotelId) throw new NotFoundError('Línea no encontrada')
  const patch: Record<string, unknown> = {}
  if (dto.notes !== undefined) patch.notes = dto.notes
  if (dto.quantity !== undefined) {
    const quantity = assertQuantity(dto.quantity)
    patch.quantity = quantity
    patch.lineTotal = round2(Number(line.unitPrice || 0) * quantity)
  }
  const updated = (await deps.lines.update(lineId, patch as Partial<Omit<OrderItemDTO, 'id'>>)) as OrderItemDTO
  await recomputeTotals(deps, order)
  return updated
}

export async function removeLine(deps: OrderLinesDeps, orderId: string, lineId: string, user: CurrentUser): Promise<void> {
  const order = await loadOrderForEdit(deps, orderId, user)
  const line = await deps.lines.findOne({ id: lineId })
  if (!line || line.orderId !== orderId || line.hotelId !== order.hotelId) throw new NotFoundError('Línea no encontrada')
  await deps.lines.delete(lineId)
  await recomputeTotals(deps, order)
}
