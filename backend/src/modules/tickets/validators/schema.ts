// tickets/validators/schema.ts — Validación de entrada

import type { ValidationRule } from 'arckode-framework'

export const CreateTicketsSchema: Record<string, ValidationRule> = {
  hotelId: { type: 'string' as const, required: true },
    userId: { type: 'string' as const, required: true },
    subject: { type: 'string' as const, required: true, min: 2, max: 200 },
    category: { type: 'string' as const },
    priority: { type: 'string' as const },
    status: { type: 'string' as const },
    description: { type: 'text' as any },
    assignedTo: { type: 'string' as const },
    messages: { type: 'json' as any },
}

export const UpdateTicketsSchema: Record<string, ValidationRule> = {
    subject: { type: 'string' as const, min: 2, max: 200 },
    category: { type: 'string' as const },
    priority: { type: 'string' as const },
    status: { type: 'string' as const },
    description: { type: 'text' as any },
    assignedTo: { type: 'string' as const },
    messages: { type: 'json' as any },
}

export const TicketsValidator = {
  create: CreateTicketsSchema,
  update: UpdateTicketsSchema,
}
