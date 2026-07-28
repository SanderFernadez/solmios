// shared/usecases/currency-rates-cron.ts — Cron nightly de tasas de cambio (F2 2.7, D10).
//
// Fetcha `https://openexchangerates.org/api/latest.json` (free tier, base=USD siembre en
// free) y guarda el resultado en `configuration(key='currency_rates', hotelId='platform')`.
// La plataforma comparte las rates con TODOS los hoteles (son tasas globales del día, no hay
// razón de fetchear por hotel). El endpoint público /rates las consume para conversión display.
//
// Env var: `OPENEXCHANGERATES_APP_ID`. Si no está, el cron loguea y SKIP silencioso (no rompe
// el arranque ni vuelve la tabla de configuration inconsistente — simplemente no actualiza).
//
// Schedule: el cron vive como factory + setInterval en composition-root (mismo molde que
// night-audit-cron / referral-credits-cron). Período: 24h (las tasas del free tier actualizan
// diariamente, fetchear más seguido es wasted quota). Primera corrida a los 10s (anti-restart).
//
// Idempotente: re-correr pisa configuration.currency_rates con el valor más reciente. Si la API
// falla (rate limit, red), conserva el valor anterior (no lo pisa con null).
//
// Anti-patrón ORM: NO toca modelos — usa orm crudo sobre `Configuration` (registrado en
// shared/models.ts). Mismo molde que los otros crones shared/* (recorre datos globales, no hay
// req.user, no hay repos inyectados por módulo).
const PLATFORM = 'platform'
const CONFIG_KEY = 'currency_rates'
const OPENEXCHANGERATES_ENDPOINT = 'https://openexchangerates.org/api/latest.json'
const ONE_DAY_MS = 24 * 60 * 60 * 1000

export interface CurrencyRatesResult {
  /** true si actualizó las rates; false si skipeó (sin APP_ID, fetch falló, response inválido). */
  updated: boolean
  /** Cantidad de monedas en la nueva versión (0 si no actualizó). */
  count: number
  /** Base de las rates guardadas (siempre 'USD' en free tier; informativo). */
  base: string
  /** Timestamp ISO de la actualización (o del intento si falló). */
  fetchedAt: string
  /** Motivo del skip cuando updated=false (para telemetría). */
  reason?: 'no_app_id' | 'fetch_failed' | 'invalid_response'
}

/**
 * Inyeccion del fetcher para testear sin tocar la red. En prod se usa `fetch` global (Bun lo
 * expone). Mismo truco que referral-credits-cron con `now`.
 */
export type RatesFetcher = (appId: string) => Promise<{ base: string; rates: Record<string, number> }>

/** Fetcher default: llama a openexchangerates. Exportado para tests puntuales si hiciera falta. */
export const defaultFetcher: RatesFetcher = async (appId: string) => {
  const url = `${OPENEXCHANGERATES_ENDPOINT}?app_id=${encodeURIComponent(appId)}&base=USD`
  const res = await fetch(url, { headers: { accept: 'application/json' } })
  if (!res.ok) {
    throw new Error(`openexchangerates responded ${res.status}: ${await res.text().catch(() => '')}`)
  }
  const json = await res.json() as { base?: string; rates?: Record<string, number> }
  if (!json || typeof json !== 'object' || !json.rates || typeof json.rates !== 'object') {
    throw new Error('openexchangerates response sin campo rates')
  }
  return { base: String(json.base || 'USD').toUpperCase(), rates: json.rates }
}

/**
 * Factory del cron. Devuelve la función que composition-root engancha a setInterval.
 *
 * @param orm           ORM del framework (lee/escribe Configuration).
 * @param logger        Logger del system.
 * @param fetcher       Fetcher inyectable (default = fetch a openexchangerates).
 * @param envAppId      Override del APP_ID para tests. En prod viene de process.env.
 */
export function createCurrencyRatesCron(
  orm: any,
  logger: any,
  fetcher: RatesFetcher = defaultFetcher,
  envAppId?: string,
): () => Promise<CurrencyRatesResult> {
  return async (): Promise<CurrencyRatesResult> => {
    const fetchedAt = new Date().toISOString()
    const appId = envAppId ?? process.env.OPENEXCHANGERATES_APP_ID
    if (!appId) {
      // Sin APP_ID: skip silencioso (el log va a warn para que se vea en prod, pero el arranque
      // no rompe). El endpoint /ratings degrada a la currency base del hotel.
      logger.info('currency-rates-cron: OPENEXCHANGERATES_APP_ID no configurado — skip')
      return { updated: false, count: 0, base: 'USD', fetchedAt, reason: 'no_app_id' }
    }

    let payload: { base: string; rates: Record<string, number> }
    try {
      payload = await fetcher(appId)
    } catch (e: any) {
      logger.warn('currency-rates-cron: fetch falló — conserva rates anteriores', { error: e?.message })
      return { updated: false, count: 0, base: 'USD', fetchedAt, reason: 'fetch_failed' }
    }

    // Sanity-check: rates tiene que tener al least USD y un par más. Si el payload es basura,
    // no pisamos la config (mejor rates viejas que rates rotas).
    if (!payload.rates || typeof payload.rates !== 'object' || Object.keys(payload.rates).length < 2) {
      logger.warn('currency-rates-cron: response inválido — conserva rates anteriores')
      return { updated: false, count: 0, base: payload.base || 'USD', fetchedAt, reason: 'invalid_response' }
    }

    const value = {
      base: payload.base || 'USD',
      rates: payload.rates,
      fetchedAt,
      // source para auditoría: confirms que venimos de openexchangerates y no de un seeder manual.
      source: 'openexchangerates',
    }

    try {
      // Upsert idempotente: si existe la fila, update; si no, create. Mismo patrón que
      // admin/usecases/modules.ts:setModulesState / referrals/program-settings.
      const existing = (await orm.findMany('Configuration', { hotelId: PLATFORM, key: CONFIG_KEY })) as any[]
      if (existing?.[0]) {
        await orm.update('Configuration', existing[0].id, { value })
      } else {
        await orm.create('Configuration', { id: crypto.randomUUID(), hotelId: PLATFORM, key: CONFIG_KEY, value })
      }
      const count = Object.keys(payload.rates).length
      logger.info('currency-rates-cron: rates actualizadas', { base: value.base, count, fetchedAt })
      return { updated: true, count, base: value.base, fetchedAt }
    } catch (e: any) {
      logger.warn('currency-rates-cron: no pudo persistir configuration.currency_rates', { error: e?.message })
      return { updated: false, count: 0, base: value.base, fetchedAt, reason: 'fetch_failed' }
    }
  }
}

/** Período del cron exportado para que composition-root use la misma constante. */
export const CURRENCY_RATES_TICK_MS = ONE_DAY_MS
