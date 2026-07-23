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

export const RestaurantValidator = { createStation: CreateStationSchema, updateStation: UpdateStationSchema }
