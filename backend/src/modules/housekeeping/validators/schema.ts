// housekeeping/validators/schema.ts — Validación de entrada

import type { ValidationRule } from 'arckode-framework'

export const CreateHousekeepingSchema: Record<string, ValidationRule> = {
    roomId: { type: 'string' as const, required: true },
  hotelId: { type: 'string' as const, required: true },
    staffId: { type: 'string' as const },
    type: { type: 'string' as const },
    priority: { type: 'string' as const },
    status: { type: 'string' as const },
    notes: { type: 'text' as any },
    assignedDate: { type: 'string' as const },
    completedDate: { type: 'string' as const },
    cleaningItems: { type: 'json' as any },
}

export const UpdateHousekeepingSchema: Record<string, ValidationRule> = {
    staffId: { type: 'string' as const },
    type: { type: 'string' as const },
    priority: { type: 'string' as const },
    status: { type: 'string' as const },
    notes: { type: 'text' as any },
    assignedDate: { type: 'string' as const },
    completedDate: { type: 'string' as const },
    cleaningItems: { type: 'json' as any },
}

export const HousekeepingValidator = {
  create: CreateHousekeepingSchema,
  update: UpdateHousekeepingSchema,
}
