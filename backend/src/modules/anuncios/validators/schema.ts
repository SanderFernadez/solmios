import type { ValidationRule } from 'arckode-framework'

export const CreateAnunciosSchema: Record<string, ValidationRule> = {
    title: { type: 'string' as const, required: true },
  hotelId: { type: 'string' as const },
    authorId: { type: 'string' as const },
    message: { type: 'text' as any },
    type: { type: 'string' as const },
    priority: { type: 'string' as const },
    active: { type: 'number' as const },
  date: { type: 'string' as const },
}

export const UpdateAnunciosSchema: Record<string, ValidationRule> = {
    title: { type: 'string' as const },
    authorId: { type: 'string' as const },
    message: { type: 'text' as any },
    type: { type: 'string' as const },
    priority: { type: 'string' as const },
    active: { type: 'number' as const },
  date: { type: 'string' as const },
}

export const AnunciosValidator = { create: CreateAnunciosSchema, update: UpdateAnunciosSchema }
