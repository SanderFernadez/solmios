import type { ValidationRule } from 'arckode-framework'

export const CreateGastosSchema: Record<string, ValidationRule> = {
  // hotelId opcional en el body (P0 V-01): el service lo fuerza desde el JWT. Solo super_admin lo usa.
  hotelId: { type: 'string' as const },
    concept: { type: 'string' as const, required: true },
    amount: { type: 'number' as const, required: true, min: 0 },
    category: { type: 'string' as const },
  date: { type: 'string' as const },
    provider: { type: 'string' as const },
  invoiceNumber: { type: 'string' as const },
    notes: { type: 'text' as any },
    paid: { type: 'number' as const },
}

export const UpdateGastosSchema: Record<string, ValidationRule> = {
    concept: { type: 'string' as const },
    amount: { type: 'number' as const },
    category: { type: 'string' as const },
  date: { type: 'string' as const },
    provider: { type: 'string' as const },
  invoiceNumber: { type: 'string' as const },
    notes: { type: 'text' as any },
    paid: { type: 'number' as const },
}

export const GastosValidator = { create: CreateGastosSchema, update: UpdateGastosSchema }
