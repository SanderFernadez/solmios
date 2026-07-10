import type { BodyRule as ValidationRule } from '../../../shared/validators/validate-body'

export const CreatePaquetesSchema: Record<string, ValidationRule> = {
  // Opcional en el body (P0 IDOR): el service lo fuerza desde el JWT. Solo super_admin lo usa.
  hotelId: { type: 'string' as const },
    name: { type: 'string' as const, required: true },
  price: { type: 'number' as const, required: true, min: 0 },
    description: { type: 'text' as const },
    type: { type: 'string' as const, enum: ['combo', 'servicio'] },
  contents: { type: 'json' as const },
    active: { type: 'number' as const },
}

export const UpdatePaquetesSchema: Record<string, ValidationRule> = {
    name: { type: 'string' as const },
  price: { type: 'number' as const, min: 0 },
    description: { type: 'text' as const },
    type: { type: 'string' as const, enum: ['combo', 'servicio'] },
  contents: { type: 'json' as const },
    active: { type: 'number' as const },
}

export const PaquetesValidator = { create: CreatePaquetesSchema, update: UpdatePaquetesSchema }
