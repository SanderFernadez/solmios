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
  /** GBP devuelve `starRating` como ENUM STRING (`STAR_RATING_FIVE`), NO como número.
   *  El campo numérico existe en algunas respuestas legacy, pero el contract oficial es enum. */
  starRating?: number | string
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

/**
 * B3 fix (audit solmi-direct-booking) — Mapa del enum `starRating` de GBP a dígito 1-5.
 * La API v4 devuelve `'STAR_RATING_ONE'` .. `'STAR_RATING_FIVE'` (NO números); el código
 * viejo hacía `Number('STAR_RATING_FIVE')` → NaN → rating=0 → la wrapper descartaba el 100%
 * de las reviews GBP. Este mapa cubre el contract oficial; el regex del fallback extrae el
 * dígito si GBP agrega nuevos tokens (ej. `STAR_RATING_SIX` hipotético).
 */
const GBP_STAR_RATING_ENUM: Record<string, number> = {
  STAR_RATING_ONE: 1,
  STAR_RATING_TWO: 2,
  STAR_RATING_THREE: 3,
  STAR_RATING_FOUR: 4,
  STAR_RATING_FIVE: 5,
}

/**
 * Normaliza el `starRating` crudo de GBP a un dígito 1-5, o `null` si no es válido.
 * Acepta: número 1-5 (legacy), enum string (`STAR_RATING_FOUR`), o string numérico (`"4"`).
 * Devuelve null para cualquier otro formato → la wrapper descarta la review por rating inválido.
 */
export function parseGbpStarRating(raw: unknown): number | null {
  if (typeof raw === 'number' && Number.isFinite(raw)) {
    return raw >= 1 && raw <= 5 ? Math.floor(raw) : null
  }
  if (typeof raw === 'string' && raw.length > 0) {
    if (GBP_STAR_RATING_ENUM[raw]) return GBP_STAR_RATING_ENUM[raw]
    const match = raw.match(/(\d)/)
    if (match) {
      const n = Number(match[1])
      if (n >= 1 && n <= 5) return n
    }
  }
  return null
}

/** Mapea review cruda GBP al schema normalizado. Puro, sin IO. */
export function normalizeGbpReview(raw: GbpRawReview): NormalizedExternalReview {
  // B3 fix — Rating vía enum map; null si el formato no matchea (descartado por la wrapper).
  const rating = parseGbpStarRating(raw.starRating)
  return {
    source: 'google',
    sourceExternalId: String(raw.reviewId ?? ''),
    authorName: raw.reviewer?.displayName ?? null,
    // Rating null/NaN → 0 → filtrado por el wrapper (no queremos reviews sin rating válido).
    rating: rating ?? 0,
    title: null, // GBP no tiene título separado del comment
    comment: raw.comment ?? null,
    language: null, // GBP no expone language en el review object
    // M4 fix — Sin `createTime`, devolvemos null (NO `now()`): el cron decide descartar la
    // review o asignarle fallback de ingest. Inventar `now()` falsea la fecha real de la
    // review y rompe el orden cronológico del aggregate.
    submittedAt: raw.createTime ?? null,
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
    // M4 corolario — también descarta reviews sin submittedAt (sin fecha no aporta al aggregate).
    return reviews
      .map(normalizeGbpReview)
      .filter((r) => r.sourceExternalId && r.rating > 0 && r.submittedAt)
  } catch (e: unknown) {
    log?.warn('gbp-reviews: fetch falló — devuelve []', { error: (e as Error)?.message })
    return []
  }
}
