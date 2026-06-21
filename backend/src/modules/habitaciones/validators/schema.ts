import type { ValidationRule } from 'arckode-framework'

export const CreateHabitacionesSchema: Record<string, ValidationRule> = {
    number: { type: 'string' as const, required: true },
    type: { type: 'string' as const },
    basePrice: { type: 'number' as const, required: true },
  hotelId: { type: 'string' as const, required: true },
    name: { type: 'string' as const },
    status: { type: 'string' as const },
    description: { type: 'text' as any },
    capacity: { type: 'number' as const },
  amenities: { type: 'json' as any },
    floor: { type: 'number' as const },
}

export const UpdateHabitacionesSchema: Record<string, ValidationRule> = {
    number: { type: 'string' as const },
    type: { type: 'string' as const },
    basePrice: { type: 'number' as const },
    name: { type: 'string' as const },
    status: { type: 'string' as const },
    description: { type: 'text' as any },
    capacity: { type: 'number' as const },
  amenities: { type: 'json' as any },
    floor: { type: 'number' as const },
}

export const HabitacionesValidator = { create: CreateHabitacionesSchema, update: UpdateHabitacionesSchema }
