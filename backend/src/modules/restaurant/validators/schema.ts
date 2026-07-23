import type { BodyRule as ValidationRule } from '../../../shared/validators/validate-body'

// validateSchema devuelve SOLO los campos declarados acá (los demás se descartan en silencio, mem 1805).

// ─── Estaciones (RES-0) ───
export const CreateStationSchema: Record<string, ValidationRule> = {
  name: { type: 'string' as const, required: true },
  active: { type: 'number' as const },
  sortOrder: { type: 'number' as const },
}

export const UpdateStationSchema: Record<string, ValidationRule> = {
  name: { type: 'string' as const },
  active: { type: 'number' as const },
  sortOrder: { type: 'number' as const },
}

// ─── Carta: categorías (RES-1) ───
export const CreateCategorySchema: Record<string, ValidationRule> = {
  name: { type: 'string' as const, required: true },
  stationId: { type: 'string' as const },
  sortOrder: { type: 'number' as const },
  active: { type: 'number' as const },
}
export const UpdateCategorySchema: Record<string, ValidationRule> = {
  name: { type: 'string' as const },
  stationId: { type: 'string' as const },
  sortOrder: { type: 'number' as const },
  active: { type: 'number' as const },
}

// ─── Carta: ítems (RES-1) ───
export const CreateItemSchema: Record<string, ValidationRule> = {
  categoryId: { type: 'string' as const, required: true },
  name: { type: 'string' as const, required: true },
  description: { type: 'text' as const },
  price: { type: 'number' as const, required: true },
  taxRate: { type: 'number' as const },
  stationId: { type: 'string' as const },
  available: { type: 'number' as const },
  imageUrl: { type: 'string' as const },
  sortOrder: { type: 'number' as const },
}
export const UpdateItemSchema: Record<string, ValidationRule> = {
  categoryId: { type: 'string' as const },
  name: { type: 'string' as const },
  description: { type: 'text' as const },
  price: { type: 'number' as const },
  taxRate: { type: 'number' as const },
  stationId: { type: 'string' as const },
  available: { type: 'number' as const },
  imageUrl: { type: 'string' as const },
  sortOrder: { type: 'number' as const },
}
export const AvailabilitySchema: Record<string, ValidationRule> = {
  available: { type: 'number' as const },
}

// ─── Mesas (RES-2) ───
const TABLE_STATUSES = ['free', 'occupied', 'reserved']
export const CreateTableSchema: Record<string, ValidationRule> = {
  name: { type: 'string' as const, required: true },
  zone: { type: 'string' as const },
  capacity: { type: 'number' as const },
  status: { type: 'string' as const, enum: TABLE_STATUSES },
}
export const UpdateTableSchema: Record<string, ValidationRule> = {
  name: { type: 'string' as const },
  zone: { type: 'string' as const },
  capacity: { type: 'number' as const },
  status: { type: 'string' as const, enum: TABLE_STATUSES },
}

export const RestaurantValidator = { createStation: CreateStationSchema, updateStation: UpdateStationSchema }
