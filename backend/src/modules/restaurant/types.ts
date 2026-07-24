// restaurant/types.ts — Contrato TypeScript del módulo (API). El schema de DB vive en model.ts.

export type OrderType = 'dine_in' | 'room_service' | 'takeaway'
export type OrderStatus =
  | 'open' | 'sent' | 'preparing' | 'ready' | 'served' | 'billed' | 'charged' | 'paid' | 'cancelled'
export type LineStatus = 'new' | 'preparing' | 'ready' | 'served' | 'cancelled'
export type TableStatus = 'free' | 'occupied' | 'reserved'
export type Settlement = 'folio' | 'payment'

export interface StationDTO {
  id: string
  hotelId: string
  name: string
  active?: number
  sortOrder?: number
  createdAt: string
  updatedAt: string
}

export interface CategoryDTO {
  id: string
  hotelId: string
  name: string
  stationId?: string
  sortOrder?: number
  active?: number
  createdAt: string
  updatedAt: string
}

export interface MenuItemDTO {
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
  hasRecipe?: boolean
  createdAt: string
  updatedAt: string
}

export interface TableDTO {
  id: string
  hotelId: string
  name: string
  zone?: string
  capacity?: number
  status: TableStatus
  createdAt: string
  updatedAt: string
}

export interface OrderDTO {
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
  createdAt: string
  updatedAt: string
}

export interface OrderItemDTO {
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
  createdAt: string
  updatedAt: string
}

// Usuario autenticado del JWT (req.user). Para ownership (IDOR) y forzar hotelId.
export interface CurrentUser {
  id: string
  hotelId?: string | null
  role?: string
}
