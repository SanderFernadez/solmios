import type { ValidationRule } from 'arckode-framework'

export const CreatePaquetesSchema: Record<string, ValidationRule> = {
  hotelId: { type: 'string' as const, required: true },
    name: { type: 'string' as const, required: true },
  price: { type: 'number' as const, required: true },
    description: { type: 'text' as any },
    type: { type: 'string' as const },
  contents: { type: 'json' as any },
    active: { type: 'number' as const },
    createdAt: { type: 'string' as const },
}

export const UpdatePaquetesSchema: Record<string, ValidationRule> = {
    name: { type: 'string' as const },
  price: { type: 'number' as const },
    description: { type: 'text' as any },
    type: { type: 'string' as const },
  contents: { type: 'json' as any },
    active: { type: 'number' as const },
    createdAt: { type: 'string' as const },
}

export const PaquetesValidator = { create: CreatePaquetesSchema, update: UpdatePaquetesSchema }
