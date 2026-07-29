// connectors/tripadvisor-reviews.ts — Cliente de TripAdvisor Content API (F3, task 3.2).
// @ignore CONNECTOR_BUSINESS_LOGIC — adaptador HTTP externo, no conector inter-módulo (ver cabecera).
//
// API: https://api.content.tripadvisor.com/api/v1/location/{locationId}/reviews
// Auth: header `x-api-key: <key>`. Rate limit: 500 req/day — 1 pull por hotel por noche.
//
// El conector es un ADAPTADOR EXTERNO (HTTP client), no un conector inter-módulo
// (los que wirean sockets entre módulos del framework). Sigue el patrón "thin wrapper":
//   1. Valida config (skip silencioso si falta creds — devuelve []).
//   2. Llama la API (via fetcher inyectable — default usa `fetch` global de Bun).
//   3. Normaliza al schema `NormalizedExternalReview` (rating ya está en 1-5).
//
// Try/catch: si la API cae (500, red, rate limit), loguea y devuelve []. NO rompe el cron.
//
// Creds se leen de `configuration` (clave `tripadvisor_api_key` + `tripadvisor_location_id`)
// por hotel — el cron las resuelve y arma el config. Si falta alguno → skip silencioso [].
//
// Backlink REQUIRED (spec.md:111-115): TripAdvisor suspende la key si la landing NO muestra
// "Reviews by TripAdvisor". El frontend (F3.16 MultiChannelBadges) lo renderiza si hay reviews
// de source='tripadvisor'. El conector NO verifica el backlink (no puede — es UI).
import type { NormalizedExternalReview } from '../modules/external-reviews/types'

/** Config que el cron le pasa al conector (leen de `configuration` por hotel). */
export interface TripadvisorConfig {
  apiKey: string
  locationId: string
}

/** Shape crudo de la API TripAdvisor que nos interesa (subset). */
export interface TripadvisorRawReview {
  review_id?: string
  rating?: number
  title?: string
  text?: string
  lang?: string
  published_date?: string
  url?: string
  user?: { name?: string }
}
export interface TripadvisorRawResponse {
  data?: TripadvisorRawReview[]
}

const TRIPADVISOR_ENDPOINT = 'https://api.content.tripadvisor.com/api/v1/location'

/** Fetcher inyectable para tests. En prod usa `fetch` global. */
export type TripadvisorFetcher = (config: TripadvisorConfig) => Promise<TripadvisorRawResponse>

/** Fetcher default: llama a TripAdvisor Content API. Exportado por si hace falta mockearlo a mano. */
export const defaultTripadvisorFetcher: TripadvisorFetcher = async (config) => {
  const url = `${TRIPADVISOR_ENDPOINT}/${encodeURIComponent(config.locationId)}/reviews?key=${encodeURIComponent(config.apiKey)}&lang=en`
  const res = await fetch(url, { headers: { 'x-api-key': config.apiKey, accept: 'application/json' } })
  if (!res.ok) throw new Error(`TripAdvisor responded ${res.status}: ${await res.text().catch(() => '')}`)
  return await res.json() as TripadvisorRawResponse
}

/** Mapea una review cruda de TripAdvisor al schema normalizado. Puro, sin IO. */
export function normalizeTripadvisorReview(raw: TripadvisorRawReview): NormalizedExternalReview {
  const rating = Number(raw.rating)
  return {
    source: 'tripadvisor',
    sourceExternalId: String(raw.review_id ?? ''),
    authorName: raw.user?.name ?? null,
    // Solo ratings válidos en [1,5] pasan el filtro `rating > 0` del wrapper.
    // Rating 0 / NaN / <1 → se normaliza a 0 → filtrado (no queremos reviews sin rating).
    rating: Number.isFinite(rating) && rating >= 1 ? Math.min(5, rating) : 0,
    title: raw.title ?? null,
    comment: raw.text ?? null,
    language: raw.lang ?? null,
    submittedAt: raw.published_date ?? new Date().toISOString(),
    url: raw.url ?? null,
  }
}

/**
 * Pull de reviews de TripAdvisor para un hotel.
 * - Si falta `apiKey` o `locationId` → devuelve [] (skip silencioso, log info).
 * - Si la API cae → devuelve [] (try/catch, log warn).
 * - En éxito → array normalizado listo para el upsert batch del cron.
 */
export async function fetchTripadvisorReviews(
  config: Partial<TripadvisorConfig>,
  fetcher: TripadvisorFetcher = defaultTripadvisorFetcher,
  log?: { info: (m: string, c?: unknown) => void; warn: (m: string, c?: unknown) => void },
): Promise<NormalizedExternalReview[]> {
  if (!config.apiKey || !config.locationId) {
    log?.info('tripadvisor-reviews: creds faltantes — skip', { hasApiKey: !!config.apiKey, hasLocationId: !!config.locationId })
    return []
  }
  try {
    const raw = await fetcher(config as TripadvisorConfig)
    const reviews = raw.data ?? []
    return reviews.map(normalizeTripadvisorReview).filter((r) => r.sourceExternalId && r.rating > 0)
  } catch (e: unknown) {
    log?.warn('tripadvisor-reviews: fetch falló — devuelve []', { error: (e as Error)?.message })
    return []
  }
}
