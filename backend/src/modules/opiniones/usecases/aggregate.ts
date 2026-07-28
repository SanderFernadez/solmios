// opiniones/usecases/aggregate.ts — F0 (solmi-direct-booking / public-reviews 0.10)
// Aggregate score computado al vuelo y cacheado (NO persistido en columna — evita
// desincronización, spec public-reviews/spec.md:47-63). Agrupa por `channel` y promedia
// sobre las reseñas visibles (status='visible' AND visible=1).
//
// Task 0.10 contract: devuelve `{ score, count, perSource }`. Extendido con `distribution`
// (count por estrella 1-5) para que el endpoint público (0.11) no vuelva a hacer fetch de
// las mismas filas — un solo fetch sirve aggregate + distribución. Tests de 0.10 validan
// los 3 campos del contrato; distribution es bonus documentado.
//
// Cache: CacheAdapter solo borra claves exactas (no glob) → clave versionada. Bumpea `v1`
// (o invalida por hotelId) cuando F3 ingestion escriba nuevas reviews externas.

import type { RepositoryAdapter, CacheAdapter } from 'arckode-framework'
import type { OpinionesDTO } from '../types'

export interface AggregatePerSource {
  score: number
  count: number
}
export interface AggregateResult {
  score: number // 0-5, 2 decimals (0 si sin reviews)
  count: number
  perSource: Record<string, AggregatePerSource>
}
export interface DistributionResult {
  '1': number
  '2': number
  '3': number
  '4': number
  '5': number
}
/** Contrato extendido: aggregate + distribution en una sola lectura cacheada. */
export interface AggregateAndDistribution extends AggregateResult {
  distribution: DistributionResult
}

export interface AggregateDeps {
  reviewsRepo: RepositoryAdapter<OpinionesDTO>
  cache: CacheAdapter
}

const AGG_CACHE_TTL = 86_400 // 24h (spec.md:99-100). Invalidable bumpeando `v1`.
const TWO_DECIMALS = 100

export const aggregateCacheKey = (hotelId: string): string =>
  `public-reviews-aggregate:${hotelId}:v1`

const round2 = (n: number): number => Math.round(n * TWO_DECIMALS) / TWO_DECIMALS

/**
 * Computa y cachea el aggregate + distribución de reseñas visibles de un hotel.
 * Empty hotel → `{ score: 0, count: 0, perSource: {}, distribution: {1:0,2:0,3:0,4:0,5:0} }`.
 */
export async function computeAggregate(
  hotelId: string,
  deps: AggregateDeps,
): Promise<AggregateAndDistribution> {
  const cacheKey = aggregateCacheKey(hotelId)
  const cached = await deps.cache.get(cacheKey)
  if (cached) return cached as AggregateAndDistribution

  // Spec.md:41-45: MUST filtrar por status='visible' AND visible=1 (pending o invisibles
  // jamás aparecen públicamente).
  const reviews = await deps.reviewsRepo.findMany({
    hotelId,
    status: 'visible',
    visible: 1,
  } as Record<string, unknown>)
  const result = computeFromReviews(reviews)
  await deps.cache.set(cacheKey, result, AGG_CACHE_TTL)
  return result
}

/**
 * Puro: aggregate + distribución desde una lista de reviews ya cargada.
 * Útil para tests y para que el endpoint público (0.11) reutilice la misma lectura.
 */
export function computeFromReviews(reviews: OpinionesDTO[]): AggregateAndDistribution {
  return { ...computeAggregateFromReviews(reviews), distribution: computeDistribution(reviews) }
}

/** Puro: aggregate score + perSource. Sin IO — testeable sin mocks. */
export function computeAggregateFromReviews(reviews: OpinionesDTO[]): AggregateResult {
  if (!reviews.length) return { score: 0, count: 0, perSource: {} }

  const groups = new Map<string, { sum: number; count: number }>()
  let totalSum = 0
  for (const r of reviews) {
    const channel = r.channel ?? 'direct'
    const rating = Number.isFinite(r.rating) ? r.rating : 0
    const entry = groups.get(channel) ?? { sum: 0, count: 0 }
    entry.sum += rating
    entry.count += 1
    groups.set(channel, entry)
    totalSum += rating
  }

  const perSource: Record<string, AggregatePerSource> = {}
  for (const [channel, entry] of groups) {
    perSource[channel] = { score: round2(entry.sum / entry.count), count: entry.count }
  }

  return {
    score: round2(totalSum / reviews.length),
    count: reviews.length,
    perSource,
  }
}

/** Puro: distribución de estrellas 1-5. */
export function computeDistribution(reviews: OpinionesDTO[]): DistributionResult {
  const dist: DistributionResult = { '1': 0, '2': 0, '3': 0, '4': 0, '5': 0 }
  for (const r of reviews) {
    const k = Math.max(1, Math.min(5, Math.round(Number(r.rating) || 0)))
    const key = String(k) as keyof DistributionResult
    dist[key] += 1
  }
  return dist
}
