// inventario/types.ts — Contrato TypeScript (API). El schema de DB vive en model.ts.

export type ItemCategory = 'food' | 'beverage' | 'supply'
export type MovementType = 'in' | 'out' | 'adjust'
export type MovementSource = 'manual' | 'purchase_receipt' | 'pos_sale'

export interface InventoryItemDTO {
  id: string
  hotelId: string
  sku?: string
  name: string
  category: ItemCategory | string
  unit: string
  currentStock: number
  minStock: number
  avgCost: number
  active?: number
  createdAt: string
  updatedAt: string
}

export interface StockMovementDTO {
  id: string
  hotelId: string
  itemId: string
  type: MovementType
  quantity: number
  unitCost?: number
  reason?: string
  source: MovementSource | string
  sourceId?: string
  balanceAfter: number
  createdAt: string
  updatedAt: string
}

// Usuario autenticado del JWT (req.user). Para ownership (IDOR) y forzar hotelId.
export interface CurrentUser {
  id: string
  hotelId?: string | null
  role?: string
}
