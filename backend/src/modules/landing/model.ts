// landing/model.ts — Schema físico de `landing_blocks` (F1, spec landing-builder).
// DB en inglés, multi-tenant por hotelId, id = TEXT UUID, timestamps estándar.
//
// Anti-patrón ORM (mem 1805): TODO campo persistido por service/DTO/validator está
// declarado acá — case-sensitive (`sortOrder` ≠ `sortorder`). Si lo agregás en
// usecases/validators, declaralo acá también o se descarta silenciosamente.
//
// Modelo dual (regla Manager Hotel): el módulo `landing` es DUEÑO del modelo
// `LandingBlocks` → NO se define en `shared/models.ts` (mem 1805, consolidación).
import type { ModelDefinition, ORM } from 'arckode-framework'

/**
 * Bloque de la landing pública del hotel. Una fila por `type` por hotel (unique
 * lógico por `(hotelId, type)` — enforced en el usecase, no en la tabla física para
// no romper migraciones existentes; el seeder y el upsert usan `findOne({hotelId,type})`).
 *
 * `config` es un JSON libre cuyo schema depende del `type` (validado en el usecase,
 * no por el ORM). `sortOrder` entero dentro del hotel. `active` toggle visible.
 */
export const LandingBlockModel: ModelDefinition = {
  table: 'landing_blocks',
  fields: {
    id: { type: 'string', required: true },
    hotelId: { type: 'string', required: true, indexed: true },
    // 'hero' | 'gallery' | 'amenities' | 'location' | 'reviews' | 'rooms' | 'faq' | 'cta' | 'footer'
    // Validado en el usecase (enum cerrado). El ORM no impone el enum: un valor fuera de
    // la lista se persistiría, pero la API pública/admin no lo crea y los tests lo cubren.
    type: { type: 'string', required: true },
    // JSON libre, schema dependiente del `type` (spec lines 44-53).
    config: { type: 'json' },
    // Orden dentro del hotel. Default 0.
    sortOrder: { type: 'number', default: 0 },
    // Toggle visible en la landing pública. Default 1 (activo).
    active: { type: 'boolean', default: true },
  },
  timestamps: true,
}

/** Registra el modelo en el ORM. Idempotente (orm.define usa Map.set). */
export function registerLandingModels(orm: ORM): void {
  orm.define('LandingBlocks', LandingBlockModel)
}
