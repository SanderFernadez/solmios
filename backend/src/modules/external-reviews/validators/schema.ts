// external-reviews/validators/schema.ts — Validación de entrada del módulo (F3).
//
// `validateSchema` (shared/validators/validate-body.ts) devuelve SOLO los campos declarados
// acá (los demás se descartan en silencio — mem anti-patrón ORM). Por eso cada campo
// persistido que venga por la API está declarado acá o se valida en el service.
//
// La validación de enum (`source` debe estar en el union) y de rango de `rating` (1-5)
// vive en el service: el validador del framework no soporta unión discriminada, y `rating`
// admite decimales (4.5) que el `min/max` numérico sí cubre pero conviene tenerlo en el
// service para pruebas con mensajes claros. Acá dejamos el mínimo: required + tipos.
import type { ValidationRule } from 'arckode-framework'

const RATING_MIN = 1
const RATING_MAX = 5
const MAX_TITLE_LENGTH = 200
const MAX_TEXT_LENGTH = 10_000
const MAX_URL_LENGTH = 2048
const MAX_LANG_LENGTH = 16
const MAX_AUTHOR_LENGTH = 200
const MAX_EXTID_LENGTH = 256

/** POST /api/external-reviews — alta manual admin (el cron NO pasa por acá, llama directo al service). */
export const CreateExternalReviewSchema: Record<string, ValidationRule> = {
  hotelId: { type: 'string' as const, required: true },
  source: { type: 'string' as const, required: true },
  sourceExternalId: { type: 'string' as const, required: true, max: MAX_EXTID_LENGTH },
  authorName: { type: 'string' as const, max: MAX_AUTHOR_LENGTH },
  rating: { type: 'number' as const, required: true, min: RATING_MIN, max: RATING_MAX },
  title: { type: 'string' as const, max: MAX_TITLE_LENGTH },
  comment: { type: 'string' as const, max: MAX_TEXT_LENGTH },
  language: { type: 'string' as const, max: MAX_LANG_LENGTH },
  submittedAt: { type: 'string' as const, required: true },
  url: { type: 'string' as const, max: MAX_URL_LENGTH },
}

/** PUT /api/external-reviews/:id — edición. `source`/`sourceExternalId` NO van (son inmutables). */
export const UpdateExternalReviewSchema: Record<string, ValidationRule> = {
  authorName: { type: 'string' as const, max: MAX_AUTHOR_LENGTH },
  rating: { type: 'number' as const, min: RATING_MIN, max: RATING_MAX },
  title: { type: 'string' as const, max: MAX_TITLE_LENGTH },
  comment: { type: 'string' as const, max: MAX_TEXT_LENGTH },
  language: { type: 'string' as const, max: MAX_LANG_LENGTH },
  submittedAt: { type: 'string' as const },
  url: { type: 'string' as const, max: MAX_URL_LENGTH },
}

/** Compuesto para usar en validación directa desde el controller. */
export const ExternalReviewsValidator = {
  create: CreateExternalReviewSchema,
  update: UpdateExternalReviewSchema,
}
