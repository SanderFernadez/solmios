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
  // Azul: MerchantId · CardNet: Comercio/Terminal.
  merchantId: { type: 'string' as const, max: 100 },
  terminalId: { type: 'string' as const, max: 100 },
  // Certificado mTLS de Azul, en base64 (el validador de tipo 'string' colapsa TODO whitespace
  // -incluidos saltos de línea- a un solo espacio (kernel/validator.ts:45), lo que corrompería un
  // PEM real. El frontend manda el PEM codificado en base64 -sin whitespace, no le afecta el
  // colapso- y el service lo decodifica antes de guardar. NO mandar el PEM crudo acá.
  certPem: { type: 'string' as const, max: 8000 },
  certKeyPem: { type: 'string' as const, max: 8000 },
  enabled: { type: 'boolean' as const },
  isDefault: { type: 'boolean' as const },
}

export const PaymentGatewaysValidator = {
  upsert: UpsertPaymentGatewaySchema,
}
