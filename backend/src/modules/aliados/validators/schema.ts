import type { ValidationRule } from 'arckode-framework'

export const SetPayoutModeSchema: Record<string, ValidationRule> = {
  mode: { type: 'string' as const, required: true, enum: ['monthly', 'one_time'] },
}

/** Item individual dentro del array del PUT /tiers (reemplazo completo del set). El body de
 *  ese endpoint es un array, no un objeto — validateSchema exige objeto, así que el controller
 *  valida cada item del array contra este schema (mismo criterio de validación, forma distinta). */
export const CommissionTierItemSchema: Record<string, ValidationRule> = {
  fromCount: { type: 'number' as const, required: true, min: 0, max: 1000 },
  percent: { type: 'number' as const, required: true, min: 0, max: 100 },
  sortOrder: { type: 'number' as const, min: 0 },
}

// #559 — soporte de Aliado Certificado a sus hoteles. Todos opcionales: PATCH parcial,
// pero el usecase igual rechaza un body vacío ("Nada para actualizar").
export const UpdateReferredHotelSchema: Record<string, ValidationRule> = {
  descriptionJson: { type: 'string' as const },
  address: { type: 'string' as const },
  latitude: { type: 'number' as const },
  longitude: { type: 'number' as const },
}

export const EscalateHotelSchema: Record<string, ValidationRule> = {
  comment: { type: 'string' as const, required: true, min: 5, max: 2000 },
}
