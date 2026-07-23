// services/Restaurant.service.ts — Cliente API del POS de restaurante (RES-7).
// Interfaces del dominio inline (convención de módulos nuevos). El http client desenvuelve el envelope
// del framework y inyecta el token/hotelId por JWT; acá NUNCA se toca el token. Backend: /api/restaurant/*.
import { http } from './http'

// ─── Tipos del dominio (espejo de backend/src/modules/restaurant/types.ts) ───
export type OrderType = 'dine_in' | 'room_service' | 'takeaway'
export type OrderStatus =
  | 'open' | 'sent' | 'preparing' | 'ready' | 'served' | 'billed' | 'charged' | 'paid' | 'cancelled'
export type LineStatus = 'new' | 'preparing' | 'ready' | 'served' | 'cancelled'
export type TableStatus = 'free' | 'occupied' | 'reserved'
export type Settlement = 'folio' | 'payment'

export interface Station {
  id: string
  hotelId: string
  name: string
  active?: number
  sortOrder?: number
  createdAt?: string
  updatedAt?: string
}

export interface MenuCategory {
  id: string
  hotelId: string
  name: string
  stationId?: string
  sortOrder?: number
  active?: number
  createdAt?: string
  updatedAt?: string
}

export interface MenuItem {
  id: string
  hotelId: string
  categoryId: string
  name: string
  description?: string
  price: number
  taxRate?: number
  stationId?: string
  available?: number
  imageUrl?: string
  sortOrder?: number
  createdAt?: string
  updatedAt?: string
}

export interface RestaurantTable {
  id: string
  hotelId: string
  name: string
  zone?: string
  capacity?: number
  status: TableStatus
  createdAt?: string
  updatedAt?: string
}

export interface OrderLine {
  id: string
  hotelId: string
  orderId: string
  menuItemId?: string
  name: string
  unitPrice: number
  quantity: number
  notes?: string
  taxRate?: number
  stationId?: string
  stationName?: string
  status: LineStatus
  lineTotal: number
  createdAt?: string
  updatedAt?: string
}

export interface Order {
  id: string
  hotelId: string
  number?: string
  type: OrderType
  tableId?: string
  reservationId?: string
  guestId?: string
  roomId?: string
  waiterId?: string
  status: OrderStatus
  subtotal: number
  tax: number
  tip: number
  total: number
  settlement?: Settlement
  folioId?: string
  paymentId?: string
  openedAt?: string
  closedAt?: string
  createdAt?: string
  updatedAt?: string
}

export type OrderWithLines = Order & { lines: OrderLine[] }

/** Ticket del KDS: comanda + sus líneas activas (new/preparing/ready) de la estación. */
export interface KdsTicket {
  order: Pick<Order, 'id' | 'number' | 'type' | 'tableId' | 'openedAt' | 'status'>
  lines: OrderLine[]
}

// ─── Payloads ───
export interface StationPayload { name: string; active?: number; sortOrder?: number }
export interface CategoryPayload { name: string; stationId?: string; sortOrder?: number; active?: number }
export interface MenuItemPayload {
  categoryId: string; name: string; description?: string; price: number
  taxRate?: number; stationId?: string; available?: number; imageUrl?: string; sortOrder?: number
}
export interface TablePayload { name: string; zone?: string; capacity?: number; status?: TableStatus }
export interface OpenOrderPayload {
  type: OrderType; tableId?: string; reservationId?: string; guestId?: string; roomId?: string; waiterId?: string
}
export interface AddLinePayload { menuItemId: string; quantity?: number; notes?: string }
export interface UpdateLinePayload { quantity?: number; notes?: string }

export const RestaurantService = {
  // ─── Estaciones (pantallas KDS configurables) ───
  async listStations(): Promise<Station[]> {
    const res = await http.get<{ data: Station[]; total: number }>('/restaurant/stations')
    return res.data ?? []
  },
  createStation: (data: StationPayload): Promise<Station> => http.post('/restaurant/stations', data),
  updateStation: (id: string, data: Partial<StationPayload>): Promise<Station> => http.put(`/restaurant/stations/${id}`, data),
  deleteStation: (id: string): Promise<void> => http.delete(`/restaurant/stations/${id}`),

  // ─── Carta: categorías ───
  async listCategories(): Promise<MenuCategory[]> {
    const res = await http.get<{ data: MenuCategory[]; total: number }>('/restaurant/categories')
    return res.data ?? []
  },
  createCategory: (data: CategoryPayload): Promise<MenuCategory> => http.post('/restaurant/categories', data),
  updateCategory: (id: string, data: Partial<CategoryPayload>): Promise<MenuCategory> => http.put(`/restaurant/categories/${id}`, data),
  deleteCategory: (id: string): Promise<void> => http.delete(`/restaurant/categories/${id}`),

  // ─── Carta: ítems ───
  async listItems(categoryId?: string): Promise<MenuItem[]> {
    const qs = categoryId ? `?categoryId=${encodeURIComponent(categoryId)}` : ''
    const res = await http.get<{ data: MenuItem[]; total: number }>(`/restaurant/menu-items${qs}`)
    return res.data ?? []
  },
  createItem: (data: MenuItemPayload): Promise<MenuItem> => http.post('/restaurant/menu-items', data),
  updateItem: (id: string, data: Partial<MenuItemPayload>): Promise<MenuItem> => http.put(`/restaurant/menu-items/${id}`, data),
  setItemAvailability: (id: string, available: number): Promise<MenuItem> => http.put(`/restaurant/menu-items/${id}/availability`, { available }),
  deleteItem: (id: string): Promise<void> => http.delete(`/restaurant/menu-items/${id}`),

  // ─── Mesas / salón ───
  async listTables(): Promise<RestaurantTable[]> {
    const res = await http.get<{ data: RestaurantTable[]; total: number }>('/restaurant/tables')
    return res.data ?? []
  },
  createTable: (data: TablePayload): Promise<RestaurantTable> => http.post('/restaurant/tables', data),
  updateTable: (id: string, data: Partial<TablePayload>): Promise<RestaurantTable> => http.put(`/restaurant/tables/${id}`, data),
  deleteTable: (id: string): Promise<void> => http.delete(`/restaurant/tables/${id}`),

  // ─── Comandas ───
  async listOrders(query?: { status?: string; tableId?: string }): Promise<Order[]> {
    const qs = new URLSearchParams()
    if (query?.status) qs.set('status', query.status)
    if (query?.tableId) qs.set('tableId', query.tableId)
    const q = qs.toString()
    const res = await http.get<{ data: Order[]; total: number }>(`/restaurant/orders${q ? `?${q}` : ''}`)
    return res.data ?? []
  },
  getOrder: (id: string): Promise<OrderWithLines> => http.get(`/restaurant/orders/${id}`),
  openOrder: (data: OpenOrderPayload): Promise<Order> => http.post('/restaurant/orders', data),
  sendOrder: (id: string): Promise<Order> => http.post(`/restaurant/orders/${id}/send`),
  cancelOrder: (id: string): Promise<Order> => http.post(`/restaurant/orders/${id}/cancel`),
  addLine: (orderId: string, data: AddLinePayload): Promise<OrderLine> => http.post(`/restaurant/orders/${orderId}/items`, data),
  updateLine: (orderId: string, lineId: string, data: UpdateLinePayload): Promise<OrderLine> => http.put(`/restaurant/orders/${orderId}/items/${lineId}`, data),
  removeLine: (orderId: string, lineId: string): Promise<void> => http.delete(`/restaurant/orders/${orderId}/items/${lineId}`),

  // ─── Cuenta + cobro ───
  billOrder: (id: string, data: { tip?: number }): Promise<Order> => http.post(`/restaurant/orders/${id}/bill`, data),
  chargeToRoom: (id: string, data: { reservationId?: string }): Promise<Order> => http.post(`/restaurant/orders/${id}/charge-to-room`, data),
  payOrder: (id: string, data: { method: string }): Promise<Order> => http.post(`/restaurant/orders/${id}/pay`, data),

  // ─── KDS / cocina ───
  async kdsQueue(station?: string): Promise<KdsTicket[]> {
    const qs = station ? `?station=${encodeURIComponent(station)}` : ''
    const res = await http.get<{ data: KdsTicket[]; total: number }>(`/restaurant/kds${qs}`)
    return res.data ?? []
  },
  setLineStatus: (lineId: string, status: LineStatus): Promise<OrderLine> => http.put(`/restaurant/kds/lines/${lineId}`, { status }),
}

// ─── Labels ES para la UI ───
export const ORDER_TYPE_LABELS: Record<string, string> = {
  dine_in: 'En salón', room_service: 'Room service', takeaway: 'Para llevar',
}
export const ORDER_STATUS_LABELS: Record<string, string> = {
  open: 'Abierta', sent: 'Enviada', preparing: 'En preparación', ready: 'Lista', served: 'Servida',
  billed: 'Con cuenta', charged: 'Cargada a habitación', paid: 'Pagada', cancelled: 'Cancelada',
}
export const LINE_STATUS_LABELS: Record<string, string> = {
  new: 'Nueva', preparing: 'Preparando', ready: 'Lista', served: 'Servida', cancelled: 'Cancelada',
}
export const TABLE_STATUS_LABELS: Record<string, string> = {
  free: 'Libre', occupied: 'Ocupada', reserved: 'Reservada',
}
