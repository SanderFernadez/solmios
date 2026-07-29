// opiniones/usecases/public-list.ts — F0 (solmi-direct-booking / public-reviews 0.11)
// Helpers PUR OS de sanitización para el endpoint público.
// Allow-list estricta: nunca expone `response`, `guestId`, `token`, `hotelId`, `id`,
// `sourceExternalId`, `reservationId`, ni campos internos. Solo lo que ve un visitante
// anónimo en la landing (spec.md:142-166).
//
// `comment` y `response` se gatean por flags del hotel (publishReviewComments /
// publishReviewScore — este último se aplica en el aggregate, no acá).

import type { OpinionesDTO } from '../types'

/**
 * Salida pública de una reseña. Sin datos internos ni identificadores cruzables.
 * `authorName` es null para direct reviews (no guardamos nombre del autor en la reseña —
 * solo `guestId`, que NO se expone). F3 podrá resolver nombres de OTA (google/etc.) al
 * ingerir reseñas externas; mientras tanto, null es más seguro que inventar.
 */
export interface PublicReviewDTO {
  rating: number
  title: string | null
  comment: string | null
  channel: string
  date: string | null
  authorName: string | null
  /** F3 3.4+ — link a la review original en la fuente externa (TripAdvisor/Google/OTA).
   *  `null` para direct reviews (no aplica) o cuando la fuente externa no trae url.
   *  Requerido por reputation-aggregator/spec.md:111-115: TripAdvisor exige backlink
   *  visible en la landing o puede suspender la API key. */
  sourceUrl: string | null
}

export interface SanitizeOptions {
  /** true → el hotel oculta comentarios (publishReviewComments=false). */
  hideComment: boolean
}

/** Allow-list mapper. NO muta la entrada. */
export function sanitizePublicReview(
  review: OpinionesDTO,
  opts: SanitizeOptions,
): PublicReviewDTO {
  const channel = review.channel ?? 'direct'
  const date = review.date ?? review.createdAt ?? null
  return {
    rating: review.rating,
    title: review.title ?? null,
    comment: opts.hideComment ? null : review.comment ?? null,
    channel,
    date,
    authorName: null,
    sourceUrl: null,
  }
}

/** Batch helper. */
export function sanitizePublicReviews(
  reviews: OpinionesDTO[],
  opts: SanitizeOptions,
): PublicReviewDTO[] {
  return reviews.map((r) => sanitizePublicReview(r, opts))
}
