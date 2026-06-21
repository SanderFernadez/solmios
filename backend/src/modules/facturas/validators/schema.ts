// facturas/validators/schema.ts — Validacion de entrada

import type { ValidationRule } from 'arckode-framework'

const TYPE_ENUM = ['invoice', 'payment', 'folio', 'receipt', 'credit_note']
const STATUS_ENUM = ['pending', 'paid', 'overdue', 'cancelled', 'draft']
const MAX_NOTES_LENGTH = 2000

export const CreateFacturasSchema: Record<string, ValidationRule> = {
  hotelId: { type: 'string' as const, required: true },
  amount: { type: 'number' as const, required: true, min: 0 },
  invoiceNumber: { type: 'string' as const, max: 50 },
  issueDate: { type: 'string' as const },
  reservationId: { type: 'string' as const },
  guestId: { type: 'string' as const },
  type: { type: 'string' as const, enum: TYPE_ENUM },
  currency: { type: 'string' as const, min: 3, max: 3 },
  status: { type: 'string' as const, enum: STATUS_ENUM },
  dueDate: { type: 'string' as const },
  paymentMethod: { type: 'string' as const, max: 50 },
  notes: { type: 'string' as const, max: MAX_NOTES_LENGTH },
  ncf: { type: 'string' as const, max: 50 },
}

export const UpdateFacturasSchema: Record<string, ValidationRule> = {
  invoiceNumber: { type: 'string' as const, max: 50 },
  amount: { type: 'number' as const, min: 0 },
  taxes: { type: 'number' as const, min: 0 },
  issueDate: { type: 'string' as const },
  reservationId: { type: 'string' as const },
  guestId: { type: 'string' as const },
  type: { type: 'string' as const, enum: TYPE_ENUM },
  currency: { type: 'string' as const, min: 3, max: 3 },
  status: { type: 'string' as const, enum: STATUS_ENUM },
  dueDate: { type: 'string' as const },
  paymentMethod: { type: 'string' as const, max: 50 },
  notes: { type: 'string' as const, max: MAX_NOTES_LENGTH },
  ncf: { type: 'string' as const, max: 50 },
}

export const FacturasValidator = {
  create: CreateFacturasSchema,
  update: UpdateFacturasSchema,
}
