// payment-gateways/validators/schema.ts — Validación de entrada

import type { ValidationRule } from 'arckode-framework'

export const UpsertPaymentGatewaySchema: Record<string, ValidationRule> = {
  provider: { type: 'string' as const, required: true, enum: ['stripe', 'paypal', 'azul', 'cardnet'] },
  mode: { type: 'string' as const, required: true, enum: ['test', 'live'] },
  // Vacíos = conservar los guardados. El service NO los pisa con '' (mismo criterio que TTLock:
  // no hay que re-tipear el secreto para cambiar la moneda).
  secretKey: { type: 'string' as const, max: 300 },
  publishableKey: { type: 'string' as const, max: 300 },
  webhookSecret: { type: 'string' as const, max: 300 },
  currency: { type: 'string' as const, min: 3, max: 3 },
  enabled: { type: 'boolean' as const },
  isDefault: { type: 'boolean' as const },
}

export const PaymentGatewaysValidator = {
  upsert: UpsertPaymentGatewaySchema,
}
