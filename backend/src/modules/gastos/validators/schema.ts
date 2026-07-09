import type { BodyRule as ValidationRule } from '../../../shared/validators/validate-body'

// `validateSchema` devuelve SOLO los campos declarados acá: un campo ausente se descarta en
// silencio antes de llegar al service, aunque exista en el DTO y en el modelo.
const PAYMENT_METHODS = ['cash', 'card', 'transfer', 'other']

export const CreateGastosSchema: Record<string, ValidationRule> = {
  // hotelId opcional en el body (P0 V-01): el service lo fuerza desde el JWT. Solo super_admin lo usa.
  hotelId: { type: 'string' as const },
    concept: { type: 'string' as const, required: true },
    amount: { type: 'number' as const, required: true, min: 0 },
    category: { type: 'string' as const },
  date: { type: 'string' as const },
    provider: { type: 'string' as const },
  invoiceNumber: { type: 'string' as const },
    notes: { type: 'text' as const },
    paid: { type: 'number' as const },
    paymentMethod: { type: 'string' as const, enum: PAYMENT_METHODS },
}

export const UpdateGastosSchema: Record<string, ValidationRule> = {
    concept: { type: 'string' as const },
    amount: { type: 'number' as const },
    category: { type: 'string' as const },
  date: { type: 'string' as const },
    provider: { type: 'string' as const },
  invoiceNumber: { type: 'string' as const },
    notes: { type: 'text' as const },
    paid: { type: 'number' as const },
    paymentMethod: { type: 'string' as const, enum: PAYMENT_METHODS },
}

export const GastosValidator = { create: CreateGastosSchema, update: UpdateGastosSchema }
