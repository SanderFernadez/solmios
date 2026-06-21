// grupos/validators/schema.ts — Validación de entrada

import type { ValidationRule } from 'arckode-framework'

export const CreateGruposSchema: Record<string, ValidationRule> = {
  hotelId: { type: 'string' as const, required: true },
    name: { type: 'string' as const, required: true, min: 2, max: 200 },
    leadGuestId: { type: 'string' as const },
    totalRooms: { type: 'number' as const },
  checkIn: { type: 'string' as const },
  checkOut: { type: 'string' as const },
    status: { type: 'string' as const },
    totalAmount: { type: 'number' as const },
    notes: { type: 'text' as any },
}

export const UpdateGruposSchema: Record<string, ValidationRule> = {
    name: { type: 'string' as const, min: 2, max: 200 },
    leadGuestId: { type: 'string' as const },
    totalRooms: { type: 'number' as const },
  checkIn: { type: 'string' as const },
  checkOut: { type: 'string' as const },
    status: { type: 'string' as const },
    totalAmount: { type: 'number' as const },
    notes: { type: 'text' as any },
}

export const GruposValidator = {
  create: CreateGruposSchema,
  update: UpdateGruposSchema,
}
