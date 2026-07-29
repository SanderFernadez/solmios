// connectors/stayapi-ota-prices.ts — Cliente de StayAPI para precios OTA (F3, task 3.15).
// @ignore CONNECTOR_BUSINESS_LOGIC — adaptador HTTP externo, no conector inter-módulo.
//
// StayAPI agrega tarifas de Booking/Airbnb/Expedia (mismo producto que stayapi-reviews.ts,
// endpoint distinto). Lo usa el endpoint público /api/public/hotels/:slug/ota-prices para
// comparar contra la tarifa directa del hotel y mostrar "Mejor precio garantizado: ahorrás $X".
//
// API (contract inferido del de reviews — StayAPI no documenta prices públicamente, pero
// sigue el mismo patrón /v1/<resource>/<ota>?hotel_id=&check_in=&check_out=):
//   GET https://api.stayapi.com/v1/prices/{ota}?hotel_id=&check_in=&check_out=
//   Auth: header `Authorization: Bearer <api_key>`.
//
// El fetcher es inyectable para tests. Si la API responde 404/error → devuelve null para
// esa OTA (graceful: el endpoint final decide si mostrar comparison o no).
//
// Importante: este connector es BEST-EFFORT. Si StayAPI cambia el contract o lo discontinúa,
// el endpoint /ota-prices degrada a `{showComparison: false}` sin romper la landing.
//
// Creds se leen de `configuration` (claves `stayapi_api_key` + `stayapi_hotel_ids` por hotel)
// — mismo config que stayapi-reviews.ts (compartido).

/** OTA source para la cual queremos comparar precios. Solo estas dos (Booking + Airbnb)
 *  porque son las que el badge muestra en el widget. Expedia queda fuera del comparison. */
export type OtaPriceSource = 'booking' | 'airbnb'

/** Respuesta normalizada: tarifa más barata encontrada en esa OTA para las fechas + currency. */
export interface OtaPriceQuote {
  source: OtaPriceSource
  /** Precio total por la estadía (no por noche), en la currency del hotel OTA. */
  amount: number
  /** Moneda del precio OTA (ej. 'USD', 'EUR'). Puede diferir de hotels.currency. */
  currency: string
}

/** Config que el endpoint le pasa al connector (mismo shape que stayapi-reviews). */
export interface StayApiPricesConfig {
  apiKey: string
  /** Map OTA → property ID en StayAPI (mismo config que stayapi-reviews). */
  hotelIds: Partial<Record<OtaPriceSource, string>>
}

/** Query params que el endpoint pasa al connector. */
export interface StayApiPricesQuery {
  checkIn: string
  checkOut: string
}

/** Shape crudo esperado de StayAPI prices (subset). */
export interface StayApiRawPrice {
  /** Precio total de la estadía (cuando viene por noche, lo multiplicamos en el caller). */
  total?: number
  /** Precio por noche (fallback si `total` no viene). */
  perNight?: number
  /** Moneda ISO-4217. */
  currency?: string
  /** Cantidad de noches que StayAPI usó para computar `total` (auditoría). */
  nights?: number
}
export interface StayApiRawPriceResponse {
  data?: StayApiRawPrice
}

const STAYAPI_PRICES_ENDPOINT = 'https://api.stayapi.com/v1/prices'

/** Fetcher inyectable: una call por OTA. En prod usa `fetch` global. */
export type StayApiPricesFetcher = (
  ota: OtaPriceSource,
  hotelId: string,
  apiKey: string,
  query: StayApiPricesQuery,
) => Promise<StayApiRawPriceResponse>

/** Fetcher default: GET /prices/{ota}?hotel_id=&check_in=&check_out= con Bearer auth. */
export const defaultStayApiPricesFetcher: StayApiPricesFetcher = async (ota, hotelId, apiKey, q) => {
  const url = `${STAYAPI_PRICES_ENDPOINT}/${ota}` +
    `?hotel_id=${encodeURIComponent(hotelId)}` +
    `&check_in=${encodeURIComponent(q.checkIn)}` +
    `&check_out=${encodeURIComponent(q.checkOut)}`
  const res = await fetch(url, { headers: { authorization: `Bearer ${apiKey}`, accept: 'application/json' } })
  if (!res.ok) {
    // 404 = StayAPI no tiene prices para esa OTA/property (común: todavía no la mapearon).
    // Otros errores sí son anomalías.
    throw new Error(`StayAPI prices ${ota} responded ${res.status}: ${await res.text().catch(() => '')}`)
  }
  return await res.json() as StayApiRawPriceResponse
}

/** Normaliza el precio crudo al OtaPriceQuote. Si el payload no trae ni `total` ni `perNight`
 *  devuelve null (la OTA no tiene tarifa para esas fechas — válido, no rompe el comparison). */
export function normalizeOtaPrice(raw: StayApiRawPrice | undefined, ota: OtaPriceSource, nights: number): OtaPriceQuote | null {
  if (!raw) return null
  const total = Number(raw.total)
  const perNight = Number(raw.perNight)
  const currency = String(raw.currency || 'USD').toUpperCase()
  // Preferimos `total` (lo que StayAPI ya computó); si no viene, derivamos desde perNight.
  if (Number.isFinite(total) && total > 0) {
    return { source: ota, amount: round2(total), currency }
  }
  if (Number.isFinite(perNight) && perNight > 0 && nights > 0) {
    return { source: ota, amount: round2(perNight * nights), currency }
  }
  return null
}

/**
 * Pull de precios OTA para un hotel. Itera las OTAs configuradas en `hotelIds` y devuelve
 * los quotes válidos. Si falta `apiKey` → devuelve []. Si una OTA falla → esa OTA se saltea
 * (try/catch interno, mismo patrón que stayapi-reviews.ts).
 *
 * El caller decide cómo comparar (directo vs OTA más barata). NO promediamos ni agregamos
 * acá: el caller necesita el dato crudo para saber si directo es más barato en AL MENOS una.
 */
export async function fetchStayApiOtaPrices(
  config: Partial<StayApiPricesConfig>,
  query: StayApiPricesQuery,
  nights: number,
  fetcher: StayApiPricesFetcher = defaultStayApiPricesFetcher,
  log?: { info: (m: string, c?: unknown) => void; warn: (m: string, c?: unknown) => void },
): Promise<OtaPriceQuote[]> {
  if (!config.apiKey || !config.hotelIds) {
    log?.info('stayapi-prices: creds faltantes — skip', { hasApiKey: !!config.apiKey, hasHotelIds: !!config.hotelIds })
    return []
  }
  const out: OtaPriceQuote[] = []
  for (const ota of ['booking', 'airbnb'] as const) {
    const externalHotelId = config.hotelIds[ota]
    if (!externalHotelId) continue
    try {
      const raw = await fetcher(ota, externalHotelId, config.apiKey, query)
      const quote = normalizeOtaPrice(raw.data, ota, nights)
      if (quote) out.push(quote)
    } catch (e: unknown) {
      log?.warn('stayapi-prices: OTA falló — continua con las demás', { ota, error: (e as Error)?.message })
    }
  }
  return out
}

function round2(n: number): number {
  return Math.round((n + Number.EPSILON) * 100) / 100
}
