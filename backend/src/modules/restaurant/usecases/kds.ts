// restaurant/usecases/kds.ts — Pantalla de cocina (RES-4). Cola de líneas activas por estación y
// transición de estado por línea (new→preparing→ready→served). El estado de la ORDEN se deriva de sus
// líneas. hotelId SIEMPRE del JWT. Ver specs/kds.spec.md.
import type { RepositoryAdapter, Auth } from 'arckode-framework'
import { NotFoundError, ValidationError } from 'arckode-framework'
import type { OrderDTO, OrderItemDTO, LineStatus, CurrentUser } from '../types'
import type { RestaurantSockets } from '../sockets'

export interface KdsDeps {
  orders: RepositoryAdapter<OrderDTO>
  lines: RepositoryAdapter<OrderItemDTO>
  userRepo: RepositoryAdapter<any>
  auth: Auth
  sockets: RestaurantSockets
}

// Estados "en cocina" (visibles en el KDS). served/cancelled salen de la cola.
const ACTIVE: LineStatus[] = ['new', 'preparing', 'ready']
// Transiciones válidas por línea. Saltos fuera de esto se rechazan.
const TRANSITIONS: Record<LineStatus, LineStatus[]> = {
  new: ['preparing', 'cancelled'],
  preparing: ['ready', 'cancelled'],
  ready: ['served'],
  served: [],
  cancelled: [],
}
// La orden solo se re-deriva mientras está en fase de cocina (no toca open/billed/charged/paid/cancelled).
const KITCHEN_ORDER_STATES: OrderDTO['status'][] = ['sent', 'preparing', 'ready', 'served']

function hotelFor(user: CurrentUser): string {
  const h = user.hotelId || ''
  if (!h) throw new ValidationError('Sin hotel asignado')
  return h
}

export interface KdsTicket { order: Pick<OrderDTO, 'id' | 'number' | 'type' | 'tableId' | 'openedAt' | 'status'>; lines: OrderItemDTO[] }

/**
 * Cola del KDS: líneas activas (new/preparing/ready) del hotel, opcionalmente filtradas por estación,
 * agrupadas por comanda y ordenadas FIFO (por apertura de la comanda). `station` vacío = todas las
 * estaciones (para el hotel de una sola pantalla); `station='__none__'` = líneas sin estación asignada.
 */
export async function kdsQueue(deps: KdsDeps, station: string | undefined, user: CurrentUser): Promise<{ data: KdsTicket[]; total: number }> {
  const hotelId = hotelFor(user)
  let lines = ((await deps.lines.findMany({ hotelId })) as OrderItemDTO[]).filter((l) => ACTIVE.includes(l.status))
  if (station === '__none__') lines = lines.filter((l) => !l.stationId)
  else if (station) lines = lines.filter((l) => l.stationId === station)

  const byOrder = new Map<string, OrderItemDTO[]>()
  for (const l of lines) {
    const arr = byOrder.get(l.orderId) ?? []
    arr.push(l)
    byOrder.set(l.orderId, arr)
  }
  const tickets: KdsTicket[] = []
  for (const [orderId, orderLines] of byOrder) {
    const order = await deps.orders.findById(orderId)
    if (!order || order.hotelId !== hotelId) continue   // aislamiento multi-tenant
    // Solo comandas en fase de cocina: excluye `open` (aún NO enviada — el mesero sigue tipeando) y
    // billed/charged/paid/cancelled (ya cerradas). Sin esto, una línea `new` de una comanda abierta o
    // las líneas de una comanda cancelada quedarían colgadas en la pantalla para siempre.
    if (!KITCHEN_ORDER_STATES.includes(order.status)) continue
    tickets.push({
      order: { id: order.id, number: order.number, type: order.type, tableId: order.tableId, openedAt: order.openedAt, status: order.status },
      lines: orderLines,
    })
  }
  tickets.sort((a, b) => String(a.order.openedAt || '').localeCompare(String(b.order.openedAt || '')))   // FIFO
  return { data: tickets, total: tickets.length }
}

/** Deriva el estado agregado de la orden a partir de sus líneas no canceladas y lo persiste si cambió. */
async function recomputeOrderStatus(deps: KdsDeps, order: OrderDTO): Promise<void> {
  if (!KITCHEN_ORDER_STATES.includes(order.status)) return
  const all = (await deps.lines.findMany({ orderId: order.id })) as OrderItemDTO[]
  const active = all.filter((l) => l.status !== 'cancelled')
  if (!active.length) return
  let next: OrderDTO['status']
  if (active.every((l) => l.status === 'served')) next = 'served'
  else if (active.every((l) => l.status === 'ready' || l.status === 'served')) next = 'ready'
  else if (active.some((l) => l.status === 'preparing' || l.status === 'ready' || l.status === 'served')) next = 'preparing'
  else next = 'sent'
  if (next !== order.status) await deps.orders.update(order.id, { status: next } as Partial<Omit<OrderDTO, 'id'>>)
}

/** Cambia el estado de una línea (transición válida) y re-deriva el estado de la comanda. */
export async function setLineStatus(deps: KdsDeps, lineId: string, status: LineStatus, user: CurrentUser): Promise<OrderItemDTO> {
  if (!status || !(status in TRANSITIONS)) throw new ValidationError(`Estado de línea inválido: ${status}`)
  // findOne (no findById): el ownership se valida cargando la orden (findById + assertOwnership) abajo.
  const line = await deps.lines.findOne({ id: lineId })
  if (!line) throw new NotFoundError('Línea no encontrada')
  const order = await deps.orders.findById(line.orderId)
  if (!order) throw new NotFoundError('Comanda no encontrada')
  const me = await deps.userRepo.findById(user.id)
  deps.auth.assertOwnership(order.hotelId, (me as any)?.hotelId ?? '', user.role, 'super_admin')

  if (!TRANSITIONS[line.status]?.includes(status)) {
    throw new ValidationError(`Transición inválida: ${line.status} → ${status}`)
  }
  const updated = (await deps.lines.update(lineId, { status } as Partial<Omit<OrderItemDTO, 'id'>>)) as OrderItemDTO
  await recomputeOrderStatus(deps, order)
  await deps.sockets.onLineStatusChanged?.(updated)
  return updated
}
