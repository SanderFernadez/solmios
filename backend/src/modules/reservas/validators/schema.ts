// reservas/validators/schema.ts — Validación de entrada

import type { ValidationRule } from 'arckode-framework'

export const CreateReservasSchema: Record<string, ValidationRule> = {
  hotelId: { type: 'string' as const, required: true },
    roomId: { type: 'string' as const, required: true },
  checkIn: { type: 'string' as const, required: true },
  checkOut: { type: 'string' as const, required: true },
    totalAmount: { type: 'number' as const, required: true },
    guestId: { type: 'string' as const },
    channel: { type: 'string' as const },
    status: { type: 'string' as const },
    currency: { type: 'string' as const },
    adults: { type: 'number' as const },
    children: { type: 'number' as const },
    deposit: { type: 'number' as const },
    notes: { type: 'text' as any },
}

export const UpdateReservasSchema: Record<string, ValidationRule> = {
    roomId: { type: 'string' as const },
  checkIn: { type: 'string' as const },
  checkOut: { type: 'string' as const },
    totalAmount: { type: 'number' as const },
    guestId: { type: 'string' as const },
    channel: { type: 'string' as const },
    status: { type: 'string' as const },
    currency: { type: 'string' as const },
    adults: { type: 'number' as const },
    children: { type: 'number' as const },
    deposit: { type: 'number' as const },
    notes: { type: 'text' as any },
}

export const ReservasValidator = {
  create: CreateReservasSchema,
  update: UpdateReservasSchema,
}
