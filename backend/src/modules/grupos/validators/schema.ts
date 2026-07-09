// grupos/validators/schema.ts — Validación de entrada

import type { BodyRule as ValidationRule } from '../../../shared/validators/validate-body'

export const CreateGruposSchema: Record<string, ValidationRule> = {
  hotelId: { type: 'string' as const, required: true },
    name: { type: 'string' as const, required: true, min: 2, max: 200 },
    leadGuestId: { type: 'string' as const },
    totalRooms: { type: 'number' as const },
  checkIn: { type: 'string' as const },
  checkOut: { type: 'string' as const },
    status: { type: 'string' as const },
    totalAmount: { type: 'number' as const },
    notes: { type: 'text' as const },
}

export const UpdateGruposSchema: Record<string, ValidationRule> = {
    name: { type: 'string' as const, min: 2, max: 200 },
    leadGuestId: { type: 'string' as const },
    totalRooms: { type: 'number' as const },
  checkIn: { type: 'string' as const },
  checkOut: { type: 'string' as const },
    status: { type: 'string' as const },
    totalAmount: { type: 'number' as const },
    notes: { type: 'text' as const },
}

export const GruposValidator = {
  create: CreateGruposSchema,
  update: UpdateGruposSchema,
}
