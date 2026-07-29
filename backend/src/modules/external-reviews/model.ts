// external-reviews/model.ts — Schema físico de `external_reviews` (F3, spec reputation-aggregator).
// DB en inglés, multi-tenant por hotelId, id = TEXT UUID, timestamps estándar.
//
// Anti-patrón ORM (mem 1805): TODO campo persistido por service/DTO/validator/cron/connectors
// está declarado acá — case-sensitive (`sourceExternalId` ≠ `sourceexternalid`). Renombrar un
// campo en el modelo = columna orphan (ADD COLUMN, no rename) → migrar data a mano.
//
// Modelo dual (regla Manager Hotel): el módulo `external-reviews` es DUEÑO del modelo
// `ExternalReviews` → NO se define en `shared/models.ts` (evita la trampa del "último gana"
// que ya picó con lock_codes.hotelId — ver CLAUDE.md "Modelos duales").
//
// Unique constraint: la tabla NO tiene UNIQUE por (source, sourceExternalId) declarado en el
// ORM (el framework no expone unique compuesto). Se crea con
// `CREATE UNIQUE INDEX IF NOT EXISTS external_reviews_source_extid
//    ON external_reviews(source, sourceExternalId)` en `migrate-db.ts` (multi-motor,
// PG lowercase, SQLite plano). El service captura la violación y la traduce a conflicto
// (mismo patrón que promo-codes / folio-entries.isDuplicateError).
//
// Index secundario (spec.md:138): `(hotelId, source, submittedAt)` para queries por hotel
// ordenadas por fecha — también creado en migrate-db.ts (índice compuesto no soportado por
// el ORM). `hotelId` y `source` se marcan `indexed: true` acá solo para los índices
// individuales que sí crea el ORM (útiles para filtros sueltos).
import type { ModelDefinition, ORM } from 'arckode-framework'

/**
 * Reseña externa (F3). Una fila por review traída del agregador (GBP/TripAdvisor/StayAPI).
 * El `source` distingue la fuente; `sourceExternalId` es el ID en esa fuente (dedup).
 */
export const ExternalReviewsModel: ModelDefinition = {
  table: 'external_reviews',
  fields: {
    id: { type: 'string', required: true },
    hotelId: { type: 'string', required: true, indexed: true },
    // 'google' | 'tripadvisor' | 'booking' | 'airbnb' | 'expedia'. Validado en el service (enum cerrado).
    source: { type: 'string', required: true, indexed: true },
    // ID externo para dedup (spec.md:127). Junto con `source` forma el UNIQUE de la tabla.
    sourceExternalId: { type: 'string', required: true },
    // Autor visible en la UI pública (spec.md:124). Nullable: algunas APIs no lo exponen.
    authorName: { type: 'string' },
    // Rating normalizado a escala 1-5 (spec.md:128). Todas las fuentes ya están en 1-5.
    rating: { type: 'number', required: true },
    // Título corto de la review (spec.md:126). Nullable.
    title: { type: 'string' },
    // Texto largo de la review (spec.md:127). `text` preserva saltos de línea (mem validate-body).
    comment: { type: 'text' },
    // ISO 639-1 ('es', 'en', 'pt'...) (spec.md:129). Nullable si la API no lo da.
    language: { type: 'string' },
    // Fecha de envío de la review (spec.md:130). ISO 8601 datetime.
    submittedAt: { type: 'date', required: true },
    // Link a la review original en la fuente (spec.md:131). Nullable.
    url: { type: 'string' },
  },
  timestamps: true,
}

/** Registra el modelo en el ORM. Idempotente (orm.define usa Map.set). */
export function registerExternalReviewsModels(orm: ORM): void {
  orm.define('ExternalReviews', ExternalReviewsModel)
}
