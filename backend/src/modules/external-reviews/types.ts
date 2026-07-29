// external-reviews/types.ts — DTOs y tipos del módulo (F3, spec reputation-aggregator).
// DB en inglés. Este archivo describe la API (NO el schema físico — eso vive en model.ts).
//
// Anti-patrón ORM (mem 1805): TODO campo declarado acá debe estar también en `model.ts`.
// Si agregás un campo acá y no allá, se descarta silenciosamente al persistir.

/** Fuentes externas que el agregador sabe ingerir (spec.md:125). */
export type ExternalReviewSource = 'google' | 'tripadvisor' | 'booking' | 'airbnb' | 'expedia'

/** Fuentes soportadas por StayAPI (las 3 OTAs que agrega) — subset de ExternalReviewSource. */
export type StayApiOta = 'booking' | 'airbnb' | 'expedia'

/** DTO principal — una reseña externa ya persistida. */
export interface ExternalReviewDTO {
  id: string
  hotelId: string
  source: ExternalReviewSource
  sourceExternalId: string
  authorName?: string | null
  rating: number
  title?: string | null
  comment?: string | null
  language?: string | null
  submittedAt: string
  url?: string | null
  createdAt: string
  updatedAt: string
}

/** Payload de creación (admin o cron). `id` lo genera el ORM. */
export interface CreateExternalReviewDTO {
  hotelId: string
  source: ExternalReviewSource
  sourceExternalId: string
  authorName?: string | null
  rating: number
  title?: string | null
  comment?: string | null
  language?: string | null
  submittedAt: string
  url?: string | null
}

/** Payload de actualización (admin). `source` y `sourceExternalId` NO son editables (son la PK lógica). */
export interface UpdateExternalReviewDTO {
  authorName?: string | null
  rating?: number
  title?: string | null
  comment?: string | null
  language?: string | null
  submittedAt?: string
  url?: string | null
}

/** Filtros de listado admin. */
export interface ExternalReviewsQuery {
  hotelId?: string
  source?: ExternalReviewSource
  minRating?: number
  maxRating?: number
  page?: number
  limit?: number
}

/** Respuesta paginada admin. */
export interface ExternalReviewsPaginated {
  data: ExternalReviewDTO[]
  total: number
  page: number
  limit: number
  pages: number
}

/** Resultado del upsert batch (cron). Para telemetría / "Sync now" count. */
export interface UpsertBatchResult {
  /** Reviews recién insertadas (no existían antes). */
  inserted: number
  /** Reviews existentes que se actualizaron con datos mutables (rating/comment/etc.). */
  updated: number
}

/**
 * Shape que devuelve cada connector (gbp/tripadvisor/stayapi) al cron.
 * NO incluye `hotelId` (lo agrega el cron antes del upsert — los connectors son por hotel).
 * Es el "schema normalizado" del spec.md:42-49.
 *
 * `submittedAt` es `string | null` (M4 fix audit solmi-direct-booking): algunos connectors
 * (GBP) pueden no recibir `createTime` de la API externa → null → el cron descarta la review
 * o aplica fallback de ingest. Antes era `string` y se rellenaba con `now()`, falseando fecha.
 */
export interface NormalizedExternalReview {
  source: ExternalReviewSource
  sourceExternalId: string
  authorName?: string | null
  rating: number
  title?: string | null
  comment?: string | null
  language?: string | null
  submittedAt: string | null
  url?: string | null
}

/** Usuario actual (del JWT o `system` para crons). */
export interface CurrentUser {
  id: string
  role: string
  hotelId?: string
}
