// pushtokens/validators/schema.ts — Validación de entrada
// Schemas planos, sin dependencias externas.

import type { ValidationRule } from 'arckode-framework'

// Un token de FCM ronda los 160 caracteres, pero Google nunca prometió un largo.
export const RegisterPushTokenSchema: Record<string, ValidationRule> = {
  token: { type: 'string' as const, required: true, min: 10, max: 512 },
  platform: { type: 'string' as const, max: 20 },
}

export const UnregisterPushTokenSchema: Record<string, ValidationRule> = {
  token: { type: 'string' as const, required: true, min: 10, max: 512 },
}

export const PushTokensValidator = {
  register: RegisterPushTokenSchema,
  unregister: UnregisterPushTokenSchema,
}
