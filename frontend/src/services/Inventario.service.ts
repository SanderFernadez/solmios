// services/Inventario.service.ts — Cliente API del inventario (INV-1/2 + recetas INT-1).
// El http client desenvuelve el envelope del framework e inyecta token/hotelId por JWT; acá NUNCA se
// toca el token. Backend: /api/inventario/*. Tipos espejo de backend/src/modules/inventario/types.ts.
import { http } from './http'

// ─── Tipos del dominio ───
export type ItemCategory = 'food' | 'beverage' | 'supply'
export type MovementType = 'in' | 'out' | 'adjust'
export type MovementSource = 'manual' | 'purchase_receipt' | 'pos_sale'

export interface InventoryItem {
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
  createdAt?: string
  updatedAt?: string
}

export interface StockMovement {
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
  createdAt?: string
  updatedAt?: string
}

export interface MenuItemRecipe {
  id: string
  hotelId: string
  menuItemId: string
  inventoryItemId: string
  quantity: number
  createdAt?: string
  updatedAt?: string
}

export interface Valuation { total: number; items: number }

// ─── Payloads ───
export interface ItemPayload {
  sku?: string
  name: string
  category?: ItemCategory | string
  unit?: string
  minStock?: number
}
export interface MovementPayload { type: MovementType; quantity: number; unitCost?: number; reason?: string }
export interface RecipePayload { menuItemId: string; inventoryItemId: string; quantity: number }

export const InventarioService = {
  // ─── Insumos ───
  async listItems(query?: { category?: string; belowMin?: boolean }): Promise<InventoryItem[]> {
    const qs = new URLSearchParams()
    if (query?.category) qs.set('category', query.category)
    if (query?.belowMin) qs.set('belowMin', '1')
    const q = qs.toString()
    const res = await http.get<{ data: InventoryItem[]; total: number }>(`/inventario/items${q ? `?${q}` : ''}`)
    return res.data ?? []
  },
  getItem: (id: string): Promise<InventoryItem> => http.get(`/inventario/items/${id}`),
  createItem: (data: ItemPayload): Promise<InventoryItem> => http.post('/inventario/items', data),
  updateItem: (id: string, data: Partial<ItemPayload> & { active?: number }): Promise<InventoryItem> => http.put(`/inventario/items/${id}`, data),
  deleteItem: (id: string): Promise<void> => http.delete(`/inventario/items/${id}`),

  // ─── Ledger de stock ───
  async listMovements(itemId: string): Promise<StockMovement[]> {
    const res = await http.get<{ data: StockMovement[]; total: number }>(`/inventario/items/${itemId}/movements`)
    return res.data ?? []
  },
  moveStock: (itemId: string, data: MovementPayload): Promise<InventoryItem> => http.post(`/inventario/items/${itemId}/movements`, data),
  valuation: (): Promise<Valuation> => http.get('/inventario/valuation'),

  // ─── Recetas / BOM ───
  async listRecipes(menuItemId: string): Promise<MenuItemRecipe[]> {
    const res = await http.get<{ data: MenuItemRecipe[]; total: number }>(`/inventario/recipes?menuItemId=${encodeURIComponent(menuItemId)}`)
    return res.data ?? []
  },
  // quantity 0 elimina la línea de receta (backend). Devuelve la receta o null.
  setRecipe: (data: RecipePayload): Promise<MenuItemRecipe | null> => http.post('/inventario/recipes', data),
}

// ─── Labels ES ───
export const ITEM_CATEGORY_LABELS: Record<string, string> = {
  food: 'Comida', beverage: 'Bebida', supply: 'Suministro',
}
export const MOVEMENT_TYPE_LABELS: Record<string, string> = {
  in: 'Entrada', out: 'Salida', adjust: 'Ajuste',
}
export const MOVEMENT_SOURCE_LABELS: Record<string, string> = {
  manual: 'Manual', purchase_receipt: 'Recepción de compra', pos_sale: 'Venta POS',
}
