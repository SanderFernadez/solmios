// opiniones/usecases/public-reviews.ts — F0 (solmi-direct-booking / public-reviews 0.11) + F3 3.4
// Orquestación del endpoint público: paginate + aggregate (cacheado) + sanitize + flags.
// Servicio sigue slim (<200 líneas, God Object analyzer): la lógica pública vive acá.
//
// Deps inyectadas: `reviewsRepo` + `externalReviewsRepo` (F3 3.4) + `cache`. El controller
// las provee (vienen del módulo). Sin auth: el hotelId lo resuelve el controller por slug
// antes de llamar.
//
// F3 3.4 (reputation-aggregator/spec.md:152-166): el listado ahora MEZCLA direct reviews
// + external_reviews, ordenadas por fecha desc (campo `submittedAt` para externas, `date`
// para direct, fallback `createdAt`). Paginación in-memory sobre la lista fusionada — los
// hoteles tienen tipicamente <1000 reviews, así que es O(n) barato. Si la tabla externa
// no existe o falla, degrada a solo direct (no rompe el endpoint).

import type { RepositoryAdapter, CacheAdapter } from 'arckode-framework'
import type { OpinionesDTO, PublicReviewsQuery, PublicReviewsResponse } from '../types'
import type { ExternalReviewDTO } from '../../external-reviews/types'
import { computeAggregate } from './aggregate'
import { sanitizePublicReview, type PublicReviewDTO } from './public-list'

export interface PublicReviewsDeps {
  reviewsRepo: RepositoryAdapter<OpinionesDTO>
  /** F3 3.4 — repo de external_reviews. Opcional para compat retro con tests F0. */
  externalReviewsRepo?: RepositoryAdapter<ExternalReviewDTO>
  cache: CacheAdapter
}

const MAX_LIMIT = 50
/** Tope para el fetch interno de direct reviews antes del merge in-memory con externas.
 *  Volúmenes típicos de un hotel son bajitos; paginación compuesta sobre los dos repos
 *  sería más costosa que leer todo acotado y mergear. Subir si un hotel pasa del umbral. */
const DIRECT_FETCH_CAP = 10_000

/**
 * F3 3.4 — Normaliza una external review al shape público. El `channel` pasa a ser el
 * `source` ('google' | 'tripadvisor' | ...) para que el filtro `?source=` del endpoint
 * siga funcionando. `date` es `submittedAt`. El comment se gatea por flag del hotel igual
 * que las direct (publishReviewComments).
 */
function externalToPublic(
  e: ExternalReviewDTO,
  opts: { hideComment: boolean },
): PublicReviewDTO {
  return {
    rating: e.rating,
    title: e.title ?? null,
    comment: opts.hideComment ? null : e.comment ?? null,
    channel: e.source,
    date: e.submittedAt ?? null,
    // authorName visible: las reviews externas sí exponen autor (GBP/TripAdvisor lo dan).
    authorName: e.authorName ?? null,
  }
}

/** Fecha útil para ordenar: direct usa `date`/`createdAt`, external `submittedAt`. */
function reviewDate(r: PublicReviewDTO): string {
  return r.date ?? ''
}

/**
 * Ejecuta el listado público de reseñas (spec public-reviews/spec.md:132-166 +
 * reputation-aggregator/spec.md:152-166 ampliado en F3 3.4).
 * - Filtra por status='visible' AND visible=1 (spec.md:24,41-45) en direct.
 * - External reviews no tienen status (siempre visibles si el cron las escribió).
 * - Pagina (default 10, max 50) sobre la lista fusionada ordenada por fecha desc.
 * - Aggregate cacheado vía computeAggregate (incluye distribution + external).
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
  const hideComment = opts.publishReviewComments === false

  // ── Direct reviews: el repo paga la paginación por nosotros (filtros compuestos).
  //    Sólo fetchea las visibles. Casos:
  //    - source='all' (default): todas las visibles.
  //    - source='direct': sólo las direct (channel='direct').
  //    - source='google'|'tripadvisor'|...: direct con ese canal histórico (puede haber
  //      reseñas migradas a mano con channel='google' en la tabla opiniones) + externas
  //      de la misma fuente. Mezclar ambas es correcto: son "reviews de google" sin
  //      importar la tabla. F0 dejaba channel='google' en opiniones como stub; F3 las
  //      ingesta por cron a external_reviews — convivencia durante la migración.
  const directFilters: Record<string, unknown> = {
    hotelId: opts.hotelId,
    status: 'visible',
    visible: 1,
  }
  if (opts.source && opts.source !== 'all') {
    directFilters.channel = opts.source
  }

  const directPaginated = await deps.reviewsRepo.paginate(directFilters, { offset: 0, limit: DIRECT_FETCH_CAP })
  const directRows = directPaginated.data

  // ── External reviews: fetchea todas y filtra en memoria por source si aplica.
  let externalRows: ExternalReviewDTO[] = []
  if (deps.externalReviewsRepo) {
    try {
      const all = await deps.externalReviewsRepo.findMany({ hotelId: opts.hotelId } as Record<string, unknown>)
      externalRows = opts.source && opts.source !== 'all' && opts.source !== 'direct'
        ? all.filter((e) => e.source === opts.source)
        : all
    } catch {
      // Tabla externa sin migrar o caída: degrada a solo direct.
      externalRows = []
    }
  }

  // ── Merge + sanitize + sort by date desc.
  const directPublic = directRows.map((r) => sanitizePublicReview(r, { hideComment }))
  const externalPublic = externalRows.map((e) => externalToPublic(e, { hideComment }))
  const merged = [...directPublic, ...externalPublic].sort((a, b) => reviewDate(b).localeCompare(reviewDate(a)))

  const total = merged.length
  const paged = merged.slice(offset, offset + limit)

  // ── Aggregate cacheado (24h). Sirve aggregate + distribution (mezcla direct+external).
  const agg = await computeAggregate(opts.hotelId, {
    reviewsRepo: deps.reviewsRepo,
    externalReviewsRepo: deps.externalReviewsRepo,
    cache: deps.cache,
  })

  return {
    reviews: paged,
    aggregate: {
      score: opts.publishReviewScore === false ? null : agg.score,
      count: agg.count,
      perSource: agg.perSource,
    },
    distribution: agg.distribution,
    pagination: {
      page,
      limit,
      total,
      totalPages: Math.ceil(total / limit) || 0,
    },
  }
}
