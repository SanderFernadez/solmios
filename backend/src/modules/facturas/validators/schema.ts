// facturas/validators/schema.ts — Validacion de entrada

import type { BodyRule as ValidationRule } from '../../../shared/validators/validate-body'

const TYPE_ENUM = ['invoice', 'credit_note'] // BM-4.1 — payment/folio/receipt eran tipos muertos
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
  items: { type: 'array' as const },
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

export const PayFacturasSchema: Record<string, ValidationRule> = {
  method: { type: 'string' as const, enum: ['card', 'cash', 'transfer', 'link', 'other'], required: true },
  amount: { type: 'number' as const, required: true, min: 0.01 },
  reference: { type: 'string' as const, max: 200 },
  notes: { type: 'string' as const, max: MAX_NOTES_LENGTH },
}

export const CreditNoteSchema: Record<string, ValidationRule> = {
  reason: { type: 'string' as const, required: true, max: 500 },
  amount: { type: 'number' as const, min: 0.01 },
}

export const EmailInvoiceSchema: Record<string, ValidationRule> = {
  to: { type: 'string' as const, required: true, max: 200 },
}

export const FacturasValidator = {
  create: CreateFacturasSchema,
  update: UpdateFacturasSchema,
  pay: PayFacturasSchema,
  creditNote: CreditNoteSchema,
  email: EmailInvoiceSchema,
}
