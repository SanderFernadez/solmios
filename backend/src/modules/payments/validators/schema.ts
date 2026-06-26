// payments/validators/schema.ts — Validación de entrada

import type { ValidationRule } from 'arckode-framework'

export const CreatePaymentSchema: Record<string, ValidationRule> = {
  hotelId: { type: 'string' as const, required: true },
  folioId: { type: 'string' as const },
  invoiceId: { type: 'string' as const },
  guestId: { type: 'string' as const },
  type: { type: 'string' as const, required: true },
  method: { type: 'string' as const, required: true },
  amount: { type: 'number' as const, required: true },
  currency: { type: 'string' as const },
  description: { type: 'string' as const },
  reference: { type: 'string' as const },
}

export const ChargeCardSchema: Record<string, ValidationRule> = {
  hotelId: { type: 'string' as const, required: true },
  amount: { type: 'number' as const, required: true },
  currency: { type: 'string' as const },
  description: { type: 'string' as const, required: true },
  folioId: { type: 'string' as const },
  guestId: { type: 'string' as const },
  successUrl: { type: 'string' as const, required: true },
  cancelUrl: { type: 'string' as const, required: true },
}

export const CreatePaymentLinkSchema: Record<string, ValidationRule> = {
  hotelId: { type: 'string' as const, required: true },
  guestId: { type: 'string' as const },
  folioId: { type: 'string' as const },
  amount: { type: 'number' as const, required: true },
  currency: { type: 'string' as const },
  description: { type: 'string' as const },
  expiresInHours: { type: 'number' as const },
  maxUses: { type: 'number' as const },
}

export const CreateDepositSchema: Record<string, ValidationRule> = {
  hotelId: { type: 'string' as const, required: true },
  reservationId: { type: 'string' as const },
  guestId: { type: 'string' as const },
  roomId: { type: 'string' as const },
  amount: { type: 'number' as const, required: true },
  currency: { type: 'string' as const },
  paymentMethod: { type: 'string' as const },
  holdReason: { type: 'string' as const },
  notes: { type: 'string' as const },
}

export const RefundDepositSchema: Record<string, ValidationRule> = {
  amount: { type: 'number' as const },
  reason: { type: 'string' as const },
}

export const ReconcileSchema: Record<string, ValidationRule> = {
  hotelId: { type: 'string' as const, required: true },
  entries: { type: 'string' as const, required: true }, // JSON array
  from: { type: 'string' as const },
  to: { type: 'string' as const },
}

export const PaymentsValidator = {
  createPayment: CreatePaymentSchema,
  chargeCard: ChargeCardSchema,
  createLink: CreatePaymentLinkSchema,
  createDeposit: CreateDepositSchema,
  refundDeposit: RefundDepositSchema,
  reconcile: ReconcileSchema,
}
