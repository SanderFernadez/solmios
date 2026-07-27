// platform-emails/validators/schema.ts — Validación de entrada.
//
// `body` es `type: 'text'` (shared/validators/validate-body.ts), NO `string` del framework: el
// caso `string` aplasta saltos de línea (`replace(/\s+/g,' ')`), y el HTML de la plantilla los
// necesita para quedar legible en el editor. Mismo criterio que `messages/validators/schema.ts`.
//
// `UpdatePlatformEmailTemplateSchema`: los 3 campos son opcionales acá (el validator no soporta
// "al menos uno requerido" entre campos) — esa regla cruzada se aplica a mano en el controller.

import type { ValidationRule } from 'arckode-framework'
import type { BodyRule } from '../../../shared/validators/validate-body'

/** Un email de plantilla es HTML con estilo inline; no es un chat, puede ser largo. */
const MAX_SUBJECT_LENGTH = 200
const MAX_BODY_LENGTH = 20_000

export const UpdatePlatformEmailTemplateSchema: Record<string, BodyRule> = {
  subject: { type: 'string' as const, max: MAX_SUBJECT_LENGTH },
  body: { type: 'text' as const, max: MAX_BODY_LENGTH },
  isActive: { type: 'boolean' as const },
}

export const SendTestEmailSchema: Record<string, ValidationRule> = {
  to: { type: 'email' as const, required: true },
}
