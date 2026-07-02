// payment-requests/validators/schema.ts — Validación de entrada (validateSchema en POST/PUT).
// Schemas planos, sin dependencias externas.

import type { ValidationRule } from 'arckode-framework'

export const CreatePaymentRequestSchema: Record<string, ValidationRule> = {
  reservationId: { type: 'string' as const, required: true },
  amount: { type: 'number' as const, required: true, min: 0 },
  currency: { type: 'string' as const },
  sentTo: { type: 'string' as const },
  sentVia: { type: 'string' as const },
  hotelId: { type: 'string' as const }, // opcional: se fuerza del JWT en el service (IDOR)
}

// Whitelist de campos actualizables (igual al handler inline original).
export const UpdatePaymentRequestSchema: Record<string, ValidationRule> = {
  amount: { type: 'number' as const, min: 0 },
  status: { type: 'string' as const },
  stripeSessionId: { type: 'string' as const },
  stripePaymentUrl: { type: 'string' as const },
  sentTo: { type: 'string' as const },
  sentVia: { type: 'string' as const },
  paidAt: { type: 'string' as const },
}

export const PaymentRequestsValidator = {
  create: CreatePaymentRequestSchema,
  update: UpdatePaymentRequestSchema,
}
