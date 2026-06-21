// facturas/validators/schema.ts — Validación de entrada

import type { ValidationRule } from 'arckode-framework'

export const CreateFacturasSchema: Record<string, ValidationRule> = {
  hotelId: { type: 'string' as const, required: true },
  amount: { type: 'number' as const, required: true },
    invoiceNumber: { type: 'string' as const },
    issueDate: { type: 'string' as const },
    reservationId: { type: 'string' as const },
    guestId: { type: 'string' as const },
    type: { type: 'string' as const },
    currency: { type: 'string' as const },
    status: { type: 'string' as const },
    dueDate: { type: 'string' as const },
    paymentMethod: { type: 'string' as const },
    notes: { type: 'text' as any },
  ncf: { type: 'string' as const },
}

export const UpdateFacturasSchema: Record<string, ValidationRule> = {
    invoiceNumber: { type: 'string' as const },
  amount: { type: 'number' as const },
    taxes: { type: 'number' as const },
    issueDate: { type: 'string' as const },
    reservationId: { type: 'string' as const },
    guestId: { type: 'string' as const },
    type: { type: 'string' as const },
    currency: { type: 'string' as const },
    status: { type: 'string' as const },
    dueDate: { type: 'string' as const },
    paymentMethod: { type: 'string' as const },
    notes: { type: 'text' as any },
  ncf: { type: 'string' as const },
}

export const FacturasValidator = {
  create: CreateFacturasSchema,
  update: UpdateFacturasSchema,
}
