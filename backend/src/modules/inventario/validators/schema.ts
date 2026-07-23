import type { BodyRule as ValidationRule } from '../../../shared/validators/validate-body'

// validateSchema devuelve SOLO los campos declarados acá (los demás se descartan en silencio, mem 1805).

const CATEGORIES = ['food', 'beverage', 'supply']
const MOVEMENT_TYPES = ['in', 'out', 'adjust']

export const CreateItemSchema: Record<string, ValidationRule> = {
  sku: { type: 'string' as const },
  name: { type: 'string' as const, required: true },
  category: { type: 'string' as const, enum: CATEGORIES },
  unit: { type: 'string' as const },
  minStock: { type: 'number' as const },
}

export const UpdateItemSchema: Record<string, ValidationRule> = {
  sku: { type: 'string' as const },
  name: { type: 'string' as const },
  category: { type: 'string' as const, enum: CATEGORIES },
  unit: { type: 'string' as const },
  minStock: { type: 'number' as const },
  active: { type: 'number' as const },
}

// Movimiento manual: entrada con costo (compra directa sin OC), salida (merma) o ajuste (conteo físico).
export const MovementSchema: Record<string, ValidationRule> = {
  type: { type: 'string' as const, required: true, enum: MOVEMENT_TYPES },
  quantity: { type: 'number' as const, required: true },
  unitCost: { type: 'number' as const },
  reason: { type: 'string' as const },
}

// Receta (BOM): consumo de un insumo por unidad vendida de un ítem de menú (INT-1).
export const RecipeSchema: Record<string, ValidationRule> = {
  menuItemId: { type: 'string' as const, required: true },
  inventoryItemId: { type: 'string' as const, required: true },
  quantity: { type: 'number' as const, required: true },
}

export const InventarioValidator = { createItem: CreateItemSchema, updateItem: UpdateItemSchema }
