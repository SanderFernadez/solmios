// promo-codes/validators/schema.ts — Validación de entrada del módulo (F2 booking-widget).
//
// `validateSchema` (shared) devuelve SOLO los campos declarados acá (los demás se
// descartan en silencio, mem anti-patrón ORM). Por eso cada campo persistido que venga
// por la API está declarado acá o se valida en el usecase.
//
// La validación de enum (`kind` debe ser 'percent'|'fixed') y de rango (`value` 0-100
// si kind='percent', >=0 si kind='fixed') vive en el usecase: depende del `kind`, y el
// validador no soporta unión discriminada.
import type { BodyRule } from '../../../shared/validators/validate-body'

/** POST /api/promo-codes — alta de un código. */
export const CreatePromoCodeSchema: Record<string, BodyRule> = {
  code: { type: 'string' as const, required: true },
  kind: { type: 'string' as const, required: true },
  value: { type: 'number' as const, required: true },
  minAmount: { type: 'number' as const },
  maxUses: { type: 'number' as const },
  validFrom: { type: 'string' as const },
  validTo: { type: 'string' as const },
  active: { type: 'boolean' as const },
}

/** PUT /api/promo-codes/:id — edición (todos opcionales, partial). */
export const UpdatePromoCodeSchema: Record<string, BodyRule> = {
  code: { type: 'string' as const },
  kind: { type: 'string' as const },
  value: { type: 'number' as const },
  minAmount: { type: 'number' as const },
  maxUses: { type: 'number' as const },
  validFrom: { type: 'string' as const },
  validTo: { type: 'string' as const },
  active: { type: 'boolean' as const },
  uses: { type: 'number' as const },
}

/** POST /api/public/hotels/:slug/promo/validate — validación pública (sin auth). */
export const ValidatePromoCodeSchema: Record<string, BodyRule> = {
  code: { type: 'string' as const, required: true },
  subtotal: { type: 'number' as const, required: true },
}

export const PromoCodesValidator = {
  create: CreatePromoCodeSchema,
  update: UpdatePromoCodeSchema,
  validate: ValidatePromoCodeSchema,
}
