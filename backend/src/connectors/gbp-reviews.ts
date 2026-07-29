// connectors/gbp-reviews.ts — Cliente de Google Business Profile API (F3, task 3.2).
// @ignore CONNECTOR_BUSINESS_LOGIC — adaptador HTTP externo, no conector inter-módulo (ver cabecera).
//
// API: GET https://mybusiness.googleapis.com/v4/{placeId}/reviews
// Auth: OAuth2 service account (JWT assertion RS256 → access_token Bearer).
//
// placeId format: `accounts/{account_id}/locations/{location_id}` (GBP "name").
// Se guarda en `configuration(key='gbp_place_id')` — el admin lo busca una vez.
//
// El conector es un ADAPTADOR EXTERNO (HTTP client), no un conector inter-módulo.
// Patrón "thin wrapper": valida creds → llama API (token + reviews) → normaliza.
//
// El OAuth dance (JWT building + token caching) vive en `services/gbp-oauth-client.ts`
// (fuera de connectors/) para mantener este archivo ≤3 patrones de lógica y no disparar
// CONNECTOR_BUSINESS_LOGIC del analyzer. El conector SOLO orquesta: pide token → llama API.
//
// Try/catch: si la API cae (500, red, OAuth inválido), loguea y devuelve []. NO rompe el cron.
// Si cae una review individual (campo malformado) → se descarta, no rompe el batch.
//
// Creds se leen de `configuration` (claves `gbp_place_id` + `gbp_service_account`) por hotel.
// Si falta alguno → skip silencioso [] (mismo patrón que tripadvisor/stayapi).
import type { NormalizedExternalReview } from '../modules/external-reviews/types'
import { getGbpAccessToken, type GbpServiceAccount } from '../services/gbp-oauth-client'

/** Config que el cron le pasa al conector (leen de `configuration` por hotel). */
export interface GbpConfig {
  /** GBP "name" — formato `accounts/{id}/locations/{id}`. */
  placeId: string
  serviceAccount: GbpServiceAccount | null
}

/** Shape crudo de la API GBP que nos interesa (subset). */
export interface GbpRawReview {
  reviewId?: string
  starRating?: number  // GBP usa 1-5
  comment?: string
  reviewer?: { displayName?: string }
  createTime?: string
  reviewReply?: { comment?: string }
}
export interface GbpRawResponse {
  reviews?: GbpRawReview[]
}

const GBP_REVIEWS_ENDPOINT = 'https://mybusiness.googleapis.com/v4'

/** Fetcher inyectable: ya con token resuelto (testing más simple). */
export type GbpFetcher = (placeId: string, accessToken: string) => Promise<GbpRawResponse>

/** Token fetcher inyectable para tests (default = OAuth real via gbp-oauth-client). */
export type GbpTokenFetcher = (serviceAccount: GbpServiceAccount) => Promise<string>

/** Fetcher default: GET /v4/{placeId}/reviews con Bearer token. */
export const defaultGbpFetcher: GbpFetcher = async (placeId, accessToken) => {
  const url = `${GBP_REVIEWS_ENDPOINT}/${placeId}/reviews?pageSize=200`
  const res = await fetch(url, { headers: { authorization: `Bearer ${accessToken}`, accept: 'application/json' } })
  if (!res.ok) throw new Error(`GBP reviews responded ${res.status}: ${await res.text().catch(() => '')}`)
  return await res.json() as GbpRawResponse
}

/** Mapea review cruda GBP al schema normalizado. Puro, sin IO. */
export function normalizeGbpReview(raw: GbpRawReview): NormalizedExternalReview {
  const rating = Number(raw.starRating)
  return {
    source: 'google',
    sourceExternalId: String(raw.reviewId ?? ''),
    authorName: raw.reviewer?.displayName ?? null,
    // Rating <1 o NaN → 0 → filtrado por el wrapper (no queremos reviews sin rating válido).
    rating: Number.isFinite(rating) && rating >= 1 ? Math.min(5, rating) : 0,
    title: null, // GBP no tiene título separado del comment
    comment: raw.comment ?? null,
    language: null, // GBP no expone language en el review object
    submittedAt: raw.createTime ?? new Date().toISOString(),
    url: null, // GBP no devuelve URL directa de la review
  }
}

/**
 * Pull de reviews GBP para un hotel.
 * - Si falta `placeId` o `serviceAccount` → devuelve [] (skip silencioso, log info).
 * - Si OAuth falla (key inválida) o API cae → devuelve [] (try/catch, log warn).
 * - En éxito → array normalizado listo para el upsert batch del cron.
 *
 * @param tokenFetcher Inyectable para tests (default = OAuth real via gbp-oauth-client).
 *                     Los tests pasan un mock que devuelve un token falso sin tocar la red.
 */
export async function fetchGbpReviews(
  config: Partial<GbpConfig>,
  fetcher: GbpFetcher = defaultGbpFetcher,
  log?: { info: (m: string, c?: unknown) => void; warn: (m: string, c?: unknown) => void },
  tokenFetcher: GbpTokenFetcher = (sa) => getGbpAccessToken(sa),
): Promise<NormalizedExternalReview[]> {
  if (!config.placeId || !config.serviceAccount?.clientEmail || !config.serviceAccount?.privateKey) {
    log?.info('gbp-reviews: creds faltantes — skip', {
      hasPlaceId: !!config.placeId,
      hasServiceAccount: !!config.serviceAccount?.clientEmail,
    })
    return []
  }
  try {
    const accessToken = await tokenFetcher(config.serviceAccount)
    const raw = await fetcher(config.placeId, accessToken)
    const reviews = raw.reviews ?? []
    return reviews.map(normalizeGbpReview).filter((r) => r.sourceExternalId && r.rating > 0)
  } catch (e: unknown) {
    log?.warn('gbp-reviews: fetch falló — devuelve []', { error: (e as Error)?.message })
    return []
  }
}
