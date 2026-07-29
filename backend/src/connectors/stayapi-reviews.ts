// connectors/stayapi-reviews.ts — Cliente de StayAPI (F3, task 3.2).
// @ignore CONNECTOR_BUSINESS_LOGIC — adaptador HTTP externo, no conector inter-módulo (ver cabecera).
//
// StayAPI es un agregador pago (€35/mes o €0.035/review) que cubre Booking/Airbnb/Expedia
// sin tener que integrar cada OTA por separado. Una llamada por OTA source por noche.
//
// API: https://api.stayapi.com/v1/reviews/{source}?hotel_id=<mapped_id>
// Auth: header `Authorization: Bearer <api_key>`.
//
// El conector es un ADAPTADOR EXTERNO (HTTP client), no un conector inter-módulo. Mismo
// patrón "thin wrapper" que tripadvisor-reviews.ts: valida creds → llama API → normaliza.
//
// Diferencia vs TripAdvisor: StayAPI maneja 3 OTAs. El config incluye un MAP
// `{booking: '123', airbnb: 'abc', expedia: '456'}` (cada OTA property ID mapeado a nuestro
// hotelId). El conector hace 3 calls (una por OTA con hotel_id mapeado) y concatena resultados.
//
// Creds se leen de `configuration` (claves `stayapi_api_key` + `stayapi_hotel_ids`) por hotel.
// Si falta api_key → skip silencioso. Si falta alguna OTA en el map → se saltea esa OTA.
import type { NormalizedExternalReview, StayApiOta, ExternalReviewSource } from '../modules/external-reviews/types'

/** Config que el cron le pasa al conector (leen de `configuration` por hotel). */
export interface StayApiConfig {
  apiKey: string
  /** Map de OTA → property ID en StayAPI. Solo las OTAs presentes se pullean. */
  hotelIds: Partial<Record<StayApiOta, string>>
}

/** Shape crudo de StayAPI (subset que nos interesa). */
export interface StayApiRawReview {
  id?: string
  rating?: number
  title?: string
  comment?: string
  language?: string
  date?: string
  url?: string
  reviewer_name?: string
}
export interface StayApiRawResponse {
  data?: StayApiRawReview[]
}

const STAYAPI_ENDPOINT = 'https://api.stayapi.com/v1/reviews'

/** Las 3 OTAs que StayAPI agrega, mapeadas al union type interno. */
const STAYAPI_OTAS: ReadonlyArray<StayApiOta> = ['booking', 'airbnb', 'expedia']

/** Fetcher inyectable: una call por OTA. En prod usa `fetch` global. */
export type StayApiFetcher = (ota: StayApiOta, hotelId: string, apiKey: string) => Promise<StayApiRawResponse>

/** Fetcher default: GET /reviews/{ota}?hotel_id=... con Bearer auth. */
export const defaultStayApiFetcher: StayApiFetcher = async (ota, hotelId, apiKey) => {
  const url = `${STAYAPI_ENDPOINT}/${ota}?hotel_id=${encodeURIComponent(hotelId)}`
  const res = await fetch(url, { headers: { authorization: `Bearer ${apiKey}`, accept: 'application/json' } })
  if (!res.ok) throw new Error(`StayAPI ${ota} responded ${res.status}: ${await res.text().catch(() => '')}`)
  return await res.json() as StayApiRawResponse
}

/** Mapea review cruda StayAPI al schema normalizado, marcando el source correcto. Puro. */
export function normalizeStayApiReview(raw: StayApiRawReview, ota: StayApiOta): NormalizedExternalReview {
  const rating = Number(raw.rating)
  return {
    source: ota as ExternalReviewSource,
    sourceExternalId: String(raw.id ?? ''),
    authorName: raw.reviewer_name ?? null,
    // Rating <1 o NaN → 0 → filtrado por el wrapper (no queremos reviews sin rating válido).
    rating: Number.isFinite(rating) && rating >= 1 ? Math.min(5, rating) : 0,
    title: raw.title ?? null,
    comment: raw.comment ?? null,
    language: raw.language ?? null,
    submittedAt: raw.date ?? new Date().toISOString(),
    url: raw.url ?? null,
  }
}

/**
 * Pull de reviews StayAPI para un hotel — itera las 3 OTAs, concatena resultados.
 * - Si falta `apiKey` → devuelve [] (skip silencioso).
 * - Si falta una OTA en `hotelIds` → esa OTA se saltea (las demás se pullean).
 * - Si la API cae para una OTA → esa OTA devuelve [] (try/catch), las demás siguen.
 *
 * Notar: cada OTA se pullea en paralelo (Promise.allSettled) desde el cron, NO acá.
 * Acá hacemos las 3 calls secuenciales dentro del try/catch del wrapper — si una falla,
 * igual devolvemos las que sí funcionaron (no descartamos todo el batch por 1 OTA caída).
 */
export async function fetchStayApiReviews(
  config: Partial<StayApiConfig>,
  fetcher: StayApiFetcher = defaultStayApiFetcher,
  log?: { info: (m: string, c?: unknown) => void; warn: (m: string, c?: unknown) => void },
): Promise<NormalizedExternalReview[]> {
  if (!config.apiKey || !config.hotelIds) {
    log?.info('stayapi-reviews: creds faltantes — skip', { hasApiKey: !!config.apiKey, hasHotelIds: !!config.hotelIds })
    return []
  }
  const out: NormalizedExternalReview[] = []
  for (const ota of STAYAPI_OTAS) {
    const externalHotelId = config.hotelIds[ota]
    if (!externalHotelId) continue
    try {
      const raw = await fetcher(ota, externalHotelId, config.apiKey)
      const reviews = raw.data ?? []
      for (const r of reviews) {
        const norm = normalizeStayApiReview(r, ota)
        if (norm.sourceExternalId && norm.rating > 0) out.push(norm)
      }
    } catch (e: unknown) {
      log?.warn('stayapi-reviews: OTA falló — continua con las demás', { ota, error: (e as Error)?.message })
    }
  }
  return out
}
