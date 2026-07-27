// restaurant/types.ts — Contrato TypeScript del módulo (API). El schema de DB vive en model.ts.

export type OrderType = 'dine_in' | 'room_service' | 'takeaway'
export type OrderStatus =
  | 'open' | 'sent' | 'preparing' | 'ready' | 'served' | 'billed' | 'charged' | 'paid' | 'cancelled' | 'refunded'
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

// F1 — snapshot de una opción elegida, congelado en la línea (sobrevive a editar/borrar el modificador).
// inventoryItemId/inventoryQuantity viajan acá (no solo en menu_item_modifiers) para que
// `consumeForSaleWithModifiers` (inventario/usecases/recipes.ts) los lea directo de la línea sin
// cross-importar del módulo restaurant — el conector solo delega la línea completa (D2, design.md).
export interface OrderItemModifierSnapshot {
  groupId: string
  groupName: string
  modifierId: string
  name: string
  priceDelta: number
  inventoryItemId?: string
  inventoryQuantity?: number
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
  // F1: snapshot de modificadores elegidos, en la MISMA fila (no sub-líneas). null/ausente = sin modificadores.
  modifiers?: OrderItemModifierSnapshot[] | null
  createdAt: string
  updatedAt: string
}

// F1 — Grupo de modificadores de un ítem (ej. "Tamaño").
export type ModifierSelectionType = 'single' | 'multiple'
export interface ModifierGroupDTO {
  id: string
  hotelId: string
  menuItemId: string
  name: string
  selectionType: ModifierSelectionType
  required?: number
  minSelect?: number
  maxSelect?: number
  sortOrder?: number
  // Derivado (no persistido en menu_item_modifier_groups): sus opciones, adjuntadas por listGroups
  // (mismo patrón que MenuItemDTO.hasRecipe). undefined si no fue enriquecido por ese usecase.
  modifiers?: ModifierDTO[]
  createdAt: string
  updatedAt: string
}

// F1 — Opción de un grupo de modificadores (ej. "Grande", "+tocino").
export interface ModifierDTO {
  id: string
  hotelId: string
  groupId: string
  name: string
  priceDelta: number
  inventoryItemId?: string
  inventoryQuantity?: number
  active?: number
  sortOrder?: number
  createdAt: string
  updatedAt: string
}

// Usuario autenticado del JWT (req.user). Para ownership (IDOR) y forzar hotelId.
export interface CurrentUser {
  id: string
  hotelId?: string | null
  role?: string
}
