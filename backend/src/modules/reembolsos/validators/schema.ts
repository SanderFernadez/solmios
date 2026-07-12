// reembolsos/validators/schema.ts — Validación de entrada.

import type { ValidationRule } from 'arckode-framework'

export const CreateReembolsosSchema: Record<string, ValidationRule> = {
  hotelId: { type: 'string' as const, required: true },
  employeeId: { type: 'string' as const, required: true },
  description: { type: 'string' as const, required: true, min: 2, max: 300 },
  amount: { type: 'number' as const, required: true, min: 0 },
  date: { type: 'string' as const, required: true },
  category: { type: 'string' as const, max: 40 },
  currency: { type: 'string' as const, max: 8 },
  receiptUrl: { type: 'string' as const, max: 400 },
  notes: { type: 'string' as const, max: 500 },
}

export const UpdateReembolsosSchema: Record<string, ValidationRule> = {
  description: { type: 'string' as const, min: 2, max: 300 },
  amount: { type: 'number' as const, min: 0 },
  date: { type: 'string' as const },
  category: { type: 'string' as const, max: 40 },
  currency: { type: 'string' as const, max: 8 },
  receiptUrl: { type: 'string' as const, max: 400 },
  notes: { type: 'string' as const, max: 500 },
}

// Pagar/reintegrar: método de pago obligatorio.
export const PayClaimSchema: Record<string, ValidationRule> = {
  paymentMethod: { type: 'string' as const, required: true, enum: ['cash', 'transfer', 'payroll'] },
}

// Rechazar requiere motivo.
export const RejectClaimSchema: Record<string, ValidationRule> = {
  reason: { type: 'string' as const, required: true, min: 3, max: 500 },
}

export const ReembolsosValidator = {
  create: CreateReembolsosSchema,
  update: UpdateReembolsosSchema,
}
