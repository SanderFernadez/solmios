// landing/validators/schema.ts — Validación de entrada del módulo landing (F1).
//
// `validateSchema` (shared) devuelve SOLO los campos declarados acá (los demás se
// descartan en silencio, mem anti-patrón ORM). Por eso cada campo persistido que venga
// por la API está declarado acá o se valida en el usecase.
//
// El body de PUT /api/landing es `{ blocks: [{type, config, sortOrder, active}, ...] }`.
// El validador solo chequea que `blocks` sea array y `active` boolean. La validación
// pormenorizada (type en el enum, config shape según type) vive en el usecase porque
// depende del `type` de cada item (unión discriminada, no soportada por validateSchema).
import type { BodyRule } from '../../../shared/validators/validate-body'

/** PUT /api/landing — body: array completo de bloques. */
export const UpsertLandingSchema: Record<string, BodyRule> = {
  blocks: { type: 'array' as const, required: true },
}

/** PATCH /api/landing/:id/toggle — body: {active: bool}. */
export const ToggleLandingSchema: Record<string, BodyRule> = {
  active: { type: 'boolean' as const, required: true },
}

/**
 * PUT /api/landing/theme — body: {templateId, colors?, fonts?}.
 *
 * `validateSchema` no soporta enum cerrado para strings: el enum de templateId
 * ('classic'|'modern'|'boutique') se valida en el usecase (`assertTemplateId`),
 * igual que `BLOCK_TYPES` en blocks-crud. `colors`/`fonts` son objetos planos
 * (sanitize de allow-list de keys también en el usecase).
 */
export const ThemeSchema: Record<string, BodyRule> = {
  templateId: { type: 'string' as const, required: true },
  colors: { type: 'object' as const, required: false },
  fonts: { type: 'object' as const, required: false },
}

export const LandingValidator = {
  upsert: UpsertLandingSchema,
  toggle: ToggleLandingSchema,
  theme: ThemeSchema,
}
