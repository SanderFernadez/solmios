export type ReviewChannel = 'direct' | 'booking' | 'airbnb' | 'expedia' | 'google' | 'other'
export type ReviewStatus = 'visible' | 'pending' // pending = invite creado en checkout, esperando respuesta del huésped

export interface OpinionesDTO {
  id: string
  hotelId: string
  guestId?: string
  reservationId?: string
  rating: number
  title?: string
  comment?: string
  response?: string
  respondedAt?: string | null // F0 0.9 — timestamp when `response` is posted (set by service.update)
  sourceExternalId?: string | null // F0 0.9 — external ID (GBP/TripAdvisor/StayAPI) for F3 dedup
  date?: string
  visible?: number
  channel?: ReviewChannel
  status?: ReviewStatus
  token?: string
  createdAt: string
  updatedAt: string
}

export interface CreateOpinionesDTO {
  hotelId: string
  guestId?: string
  reservationId?: string
  rating: number
  title?: string
  comment?: string
  response?: string
  sourceExternalId?: string // F0 0.9 — set by F3 ingestion (OTA dedup); not by hotel admin
  date?: string
  visible?: number
  channel?: ReviewChannel
}

export interface UpdateOpinionesDTO {
  // NOTE: hotelId intentionally NOT here
  guestId?: string
  reservationId?: string
  rating?: number
  title?: string
  comment?: string
  response?: string
  sourceExternalId?: string // F0 0.9 — set by F3 ingestion (OTA dedup); not by hotel admin
  date?: string
  visible?: number
  channel?: ReviewChannel
}

export interface OpinionesQuery {
  hotelId?: string
  channel?: ReviewChannel
  visible?: number
  minRating?: number
  maxRating?: number
  search?: string
  page?: number
  limit?: number
}

export interface OpinionesPaginated {
  data: OpinionesDTO[]
  total: number
  page?: number
  limit?: number
  pages?: number
}

// ─── Público (F0 0.11) — endpoint GET /api/public/hotels/:slug/reviews ───
// El controller los rellena a partir de la row Hotels + query string.

/** Input del caso de uso público (ver usecases/public-reviews.ts). */
export interface PublicReviewsQuery {
  hotelId: string
  page?: number
  limit?: number
  /** all|direct|google|tripadvisor|booking|airbnb|expedia (default 'all'). */
  source?: string
  /** i18n (F3 traducción de comments OTA); sin efecto en 0.11. */
  lang?: string
  /** Hotel.publishReviewScore (default false en model.ts:65). */
  publishReviewScore: boolean
  /** Hotel.publishReviewComments (default false en model.ts:66). */
  publishReviewComments: boolean
}

/** Salida pública del endpoint. Allow-list estricta, sin IDs internos. */
export interface PublicReviewsResponse {
  reviews: Array<{
    rating: number
    title: string | null
    comment: string | null
    channel: string
    date: string | null
    authorName: string | null
    /** M6 fix (audit solmi-direct-booking) — Link a la review original (TripAdvisor/GBP/OTA).
     *  `null` para reservas directas. El usecase ya lo devuelve; falta declararlo acá para
     *  que el contrato TypeScript coincida con el runtime (sino TS lo infiere opcional). */
    sourceUrl: string | null
  }>
  aggregate: {
    score: number | null
    count: number
    perSource: { [channel: string]: { score: number; count: number } }
  }
  distribution: { '1': number; '2': number; '3': number; '4': number; '5': number }
  pagination: { page: number; limit: number; total: number; totalPages: number }
}
