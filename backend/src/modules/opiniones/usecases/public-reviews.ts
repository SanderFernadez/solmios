// opiniones/usecases/public-reviews.ts — F0 (solmi-direct-booking / public-reviews 0.11)
// Orquestación del endpoint público: paginate + aggregate (cacheado) + sanitize + flags.
// Servicio sigue slim (<200 líneas, God Object analyzer): la lógica pública vive acá.
//
// Deps inyectadas: `reviewsRepo` + `cache`. El controller las provee (vienen del módulo).
// Sin auth: el hotelId lo resuelve el controller por slug antes de llamar.

import type { RepositoryAdapter, CacheAdapter } from 'arckode-framework'
import type { OpinionesDTO, PublicReviewsQuery, PublicReviewsResponse } from '../types'
import { computeAggregate } from './aggregate'
import { sanitizePublicReviews } from './public-list'

export interface PublicReviewsDeps {
  reviewsRepo: RepositoryAdapter<OpinionesDTO>
  cache: CacheAdapter
}

const MAX_LIMIT = 50

/**
 * Ejecuta el listado público de reseñas (spec public-reviews/spec.md:132-166).
 * - Filtra por status='visible' AND visible=1 (spec.md:24,41-45).
 * - Pagina (default 10, max 50).
 * - Aggregate cacheado vía computeAggregate (incluye distribution).
 * - Sanitiza con allow-list (sin guestId/token/hotelId/response/id).
 * - Aplica flags publishReviewScore/Comments del hotel.
 */
export async function listPublicReviews(
  opts: PublicReviewsQuery,
  deps: PublicReviewsDeps,
): Promise<PublicReviewsResponse> {
  const page = Math.max(opts.page || 1, 1)
  const limit = Math.min(Math.max(opts.limit || 10, 1), MAX_LIMIT)
  const offset = (page - 1) * limit

  const filters: Record<string, unknown> = {
    hotelId: opts.hotelId,
    status: 'visible',
    visible: 1,
  }
  if (opts.source && opts.source !== 'all') filters.channel = opts.source

  const paginated = await deps.reviewsRepo.paginate(filters, { offset, limit })

  // Aggregate cacheado (24h). Un fetch cacheado sirve aggregate + distribution.
  const agg = await computeAggregate(opts.hotelId, { reviewsRepo: deps.reviewsRepo, cache: deps.cache })

  const reviews = sanitizePublicReviews(paginated.data, {
    hideComment: opts.publishReviewComments === false,
  })

  return {
    reviews,
    aggregate: {
      score: opts.publishReviewScore === false ? null : agg.score,
      count: agg.count,
      perSource: agg.perSource,
    },
    distribution: agg.distribution,
    pagination: {
      page,
      limit,
      total: paginated.total,
      totalPages: Math.ceil(paginated.total / limit) || 0,
    },
  }
}
