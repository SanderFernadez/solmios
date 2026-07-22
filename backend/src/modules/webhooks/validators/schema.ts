// webhooks/validators/schema.ts — Validación de entrada
//
// `events` (string[]) queda FUERA de estos schemas a propósito: `ValidatorType` del framework
// (kernel/validator.ts) solo soporta string/number/boolean/email/url/date — no tiene case para
// arrays, y su `switch` no tiene `default`, así que un `type` no soportado hace que el campo
// simplemente NO aparezca en el output validado (se pierde en silencio). El propio módulo
// `amenities` ya pisó este problema (`validators/schema.ts` declara `type: arrayType as any` pero
// su controller NO usa `validateSchema` para ese campo — valida `Array.isArray()` a mano). Mismo
// criterio acá: `events` se valida a mano en el controller.

import type { ValidationRule } from 'arckode-framework'

export const CreateWebhookSubscriptionSchema: Record<string, ValidationRule> = {
  hotelId: { type: 'string' as const, required: true },
  url: { type: 'url' as const, required: true, max: 500 },
  active: { type: 'number' as const },
}

export const UpdateWebhookSubscriptionSchema: Record<string, ValidationRule> = {
  url: { type: 'url' as const, max: 500 },
  active: { type: 'number' as const },
}

export const WebhooksValidator = { create: CreateWebhookSubscriptionSchema, update: UpdateWebhookSubscriptionSchema }
