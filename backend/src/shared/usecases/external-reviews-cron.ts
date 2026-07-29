// shared/usecases/external-reviews-cron.ts — Cron nightly del agregador (F3, task 3.3).
//
// Spec: reputation-aggregator/spec.md. Para cada hotel con creds configuradas:
//   1. Pull las 3 fuentes (GBP, TripAdvisor, StayAPI) en paralelo (`Promise.allSettled`).
//   2. Concatena + dedupea por `(source, sourceExternalId)` (defensivo: si dos fuentes
//      devuelven la misma review, gana la primera — raro pero posible cuando StayAPI
//      juga con TripAdvisor Content API).
//   3. Llama `service.upsertBatch(hotelId, reviews)` — el service hace el upsert
//      (pre-fetch + create/update por fila, con UNIQUE index físico como red de seguridad).
//   4. Invalida el cache del aggregate de opiniones (`public-reviews-aggregate:${hotelId}:v1`)
//      para que el próximo GET /reviews recomputee con las reviews nuevas.
//
// Resiliencia (spec.md:32-37):
//   - Por fuente: try/catch dentro del connector → devuelve [] si cae. Nunca rompe el batch.
//   - Por hotel: try/catch around todo el ciclo del hotel → log warn, continua con el siguiente.
//   - Cron completo: try/catch outer → log warn, no rompe el setInterval de composition-root.
//
// Idempotencia (spec.md:64-71): el service.upsertBatch hace pre-fetch + create-or-update.
// Correr 2× no duplica (UNIQUE index + lógica application-layer).
//
// Schedule: 00:00 UTC en prod (spec.md:63). El wiring en composition-root.ts usa setInterval
// 24h + corrida inicial a los 10s (anti-restart, mismo molde que night-audit-cron).
//
// Cache invalidation: CacheAdapter solo borra claves exactas. La clave del aggregate
// (opiniones/usecases/aggregate.ts) es `public-reviews-aggregate:${hotelId}:v1`. La pisamos
// con `cache.delete()` tras escribir — la próxima lectura recomputea y re-cachea.
// Spec menciona `reviews:v{N}:{hotelId}` como formato deseado; el código actual usa el
// prefijo `public-reviews-aggregate` con `:v1` hardcoded (F0 0.10). Invalidamos esa clave
// exacta — cuando F3.4 cambie el formato a versión dinámica, este cron actualizará la clave.
//
// Anti-patrón ORM: NO toca modelos — usa orm crudo solo para leer `Hotels` y `Configuration`
// (mismo molde que currency-rates-cron / referral-credits-cron). El upsert lo hace el
// service del módulo (vía resolveModule), no acá.

import type { NormalizedExternalReview } from '../../modules/external-reviews/types'
import type {
  GbpConfig,
} from '../../connectors/gbp-reviews'
import type {
  TripadvisorConfig,
} from '../../connectors/tripadvisor-reviews'
import type {
  StayApiConfig,
} from '../../connectors/stayapi-reviews'

/** Shape de las funciones de fetch que el cron invoca (inyectables para tests). */
export interface ExternalReviewsFetchers {
  gbp: (c: Partial<GbpConfig>, f?: unknown, log?: LoggerLike) => Promise<NormalizedExternalReview[]>
  tripadvisor: (c: Partial<TripadvisorConfig>, f?: unknown, log?: LoggerLike) => Promise<NormalizedExternalReview[]>
  stayapi: (c: Partial<StayApiConfig>, f?: unknown, log?: LoggerLike) => Promise<NormalizedExternalReview[]>
}

interface LoggerLike {
  info: (m: string, c?: Record<string, unknown>) => void
  warn: (m: string, c?: Record<string, unknown>) => void
}

/** Resultado del cron — para log + "Sync now" del admin (3.5). */
export interface ExternalReviewsCronResult {
  hotelsProcessed: number
  totalInserted: number
  totalUpdated: number
  /** Sources skipeadas por hotel (creds faltantes o API caída). Para telemetría. */
  skippedSources: number
  errors: string[]
}

/** Config de creds para un hotel específico (leída de `configuration` por el cron). */
export interface HotelExternalConfig {
  gbp: Partial<GbpConfig>
  tripadvisor: Partial<TripadvisorConfig>
  stayapi: Partial<StayApiConfig>
}

const AGGREGATE_CACHE_PREFIX = 'public-reviews-aggregate:'
const AGGREGATE_CACHE_VERSION = 'v1'

/** Invalida la clave exacta del aggregate cache del hotel (CacheAdapter no soporta glob). */
function aggregateCacheKey(hotelId: string): string {
  return `${AGGREGATE_CACHE_PREFIX}${hotelId}:${AGGREGATE_CACHE_VERSION}`
}

/**
 * Lee la config de creds externas para un hotel desde la tabla `configuration`.
 *
 * Keys (spec.md:96-100):
 *   - `gbp_place_id` (string), `gbp_service_account` (JSON {clientEmail, privateKey})
 *   - `tripadvisor_api_key` (string), `tripadvisor_location_id` (string)
 *   - `stayapi_api_key` (string), `stayapi_hotel_ids` (JSON {booking?, airbnb?, expedia?})
 *
 * Los values pueden venir como string (la mayoría) o como objeto ya parseado (gbp_service_account
 * / stayapi_hotel_ids son JSON). Si el JSON falla al parsear, se trata como missing.
 */
export async function readHotelExternalConfig(
  orm: any,
  hotelId: string,
): Promise<HotelExternalConfig> {
  const rows = (await orm.findMany('Configuration', { hotelId })) as Array<{ key: string; value: any }>
  const byKey = new Map<string, any>()
  for (const row of rows) byKey.set(row.key, row.value)

  const parseJson = (v: any): any => {
    if (v == null) return null
    if (typeof v === 'object') return v
    try { return JSON.parse(String(v)) } catch { return null }
  }

  const gbpServiceAccount = parseJson(byKey.get('gbp_service_account'))
  const stayapiHotelIds = parseJson(byKey.get('stayapi_hotel_ids'))

  return {
    gbp: {
      placeId: byKey.get('gbp_place_id') ?? undefined,
      serviceAccount: gbpServiceAccount && gbpServiceAccount.clientEmail && gbpServiceAccount.privateKey
        ? gbpServiceAccount
        : null,
    },
    tripadvisor: {
      apiKey: byKey.get('tripadvisor_api_key') ?? undefined,
      locationId: byKey.get('tripadvisor_location_id') ?? undefined,
    },
    stayapi: {
      apiKey: byKey.get('stayapi_api_key') ?? undefined,
      hotelIds: stayapiHotelIds && typeof stayapiHotelIds === 'object' ? stayapiHotelIds : undefined,
    },
  }
}

/**
 * Pull + concat de las 3 fuentes en paralelo. Si todas caen devuelve [].
 * Usa Promise.allSettled (no Promise.all) para que un rechazo no rompa el resto —
 * aunque los connectors ya tienen try/catch interno y nunca reject (siempre devuelven []).
 * El allSettled es defense-in-depth.
 */
async function pullAllSources(
  hotelId: string,
  config: HotelExternalConfig,
  fetchers: ExternalReviewsFetchers,
  logger: LoggerLike,
): Promise<{ reviews: NormalizedExternalReview[]; skippedSources: number }> {
  const settled = await Promise.allSettled([
    fetchers.gbp(config.gbp, undefined, logger),
    fetchers.tripadvisor(config.tripadvisor, undefined, logger),
    fetchers.stayapi(config.stayapi, undefined, logger),
  ])
  const skippedSources = settled.filter((s) => s.status === 'rejected').length
  const all: NormalizedExternalReview[] = []
  for (const s of settled) {
    if (s.status === 'fulfilled') all.push(...s.value)
  }

  // Dedupe defensivo por (source, sourceExternalId) — gana la primera ocurrencia.
  // Raro entre fuentes distintas, pero StayAPI podría devolver la misma OTA review dos veces
  // si el config mapea mal. Idempotente.
  const seen = new Set<string>()
  const deduped = all.filter((r) => {
    const k = `${r.source}:${r.sourceExternalId}`
    if (seen.has(k)) return false
    seen.add(k)
    return true
  })

  if (skippedSources > 0) {
    logger.warn(`external-reviews-cron: ${skippedSources}/3 fuentes fallaron para hotel ${hotelId}`)
  }
  return { reviews: deduped, skippedSources }
}

/** Resultado de sincronizar un hotel — subset de `ExternalReviewsCronResult` para un solo hotel.
 *  Lo usa el endpoint admin "Sync now" (F3 3.5) para reportar cuántas reviews nuevas entraron. */
export interface SyncHotelResult {
  /** Reviews recién insertadas (no existían antes). */
  inserted: number
  /** Reviews existentes que se actualizaron con datos mutables. */
  updated: number
  /** Sources skipeadas (creds faltantes o API caída). */
  skippedSources: number
  /** Mensajes de error específicos del hotel (vacío si OK). */
  errors: string[]
  /** True si el hotel no tenía ninguna creds configurada (no había nada que sincronizar). */
  noCreds: boolean
}

/**
 * F3 3.5 — Ejecuta el ciclo del cron para UN hotel específico. Reutilizado por el endpoint
 * admin `POST /api/external-reviews/sync-now` (dispara el pull manualmente tras guardar creds).
 *
 * Mismo flujo que el cron nightly (read creds → pullAllSources → upsertBatch → invalidate
 * cache), pero acotado a un hotelId. NO itera todos los hoteles.
 *
 * Idempotente (spec.md:64-71): si las reviews ya están, devuelve inserted=0, updated=0.
 */
export async function syncHotelReviews(
  hotelId: string,
  orm: any,
  resolveModule: (name: string) => any,
  logger: LoggerLike,
  fetchers: ExternalReviewsFetchers,
  cache: { delete: (key: string) => Promise<unknown> },
): Promise<SyncHotelResult> {
  const result: SyncHotelResult = { inserted: 0, updated: 0, skippedSources: 0, errors: [], noCreds: false }
  try {
    const config = await readHotelExternalConfig(orm, hotelId)
    const hasAnyCreds = config.gbp.placeId || config.gbp.serviceAccount
      || config.tripadvisor.apiKey || config.tripadvisor.locationId
      || config.stayapi.apiKey || config.stayapi.hotelIds
    if (!hasAnyCreds) {
      result.noCreds = true
      logger.info(`external-reviews-sync: hotel ${hotelId} sin creds configuradas — nothing to sync`)
      return result
    }

    const { reviews, skippedSources } = await pullAllSources(hotelId, config, fetchers, logger)
    result.skippedSources = skippedSources

    if (reviews.length === 0) {
      logger.info(`external-reviews-sync: hotel ${hotelId} — 0 reviews para ingestar`)
      return result
    }

    const service = resolveModule('external-reviews') as
      | { upsertBatch: (h: string, r: NormalizedExternalReview[]) => Promise<{ inserted: number; updated: number }> }
      | null
    if (!service?.upsertBatch) {
      const msg = `hotel ${hotelId}: módulo external-reviews no disponible`
      result.errors.push(msg)
      logger.warn(`external-reviews-sync: ${msg}`)
      return result
    }

    const upsert = await service.upsertBatch(hotelId, reviews)
    result.inserted = upsert.inserted
    result.updated = upsert.updated

    // Invalida el cache del aggregate de opiniones → próximo GET /reviews recomputea.
    await cache.delete(aggregateCacheKey(hotelId)).catch(() => { /* best-effort */ })

    logger.info(`external-reviews-sync: hotel ${hotelId} sincronizado`, upsert)
  } catch (e: unknown) {
    const raw = (e as Error)?.message ?? String(e)
    const msg = `hotel ${hotelId}: ${raw}`
    result.errors.push(msg)
    logger.warn(`external-reviews-sync: falló hotel ${hotelId}`, { error: raw })
  }
  return result
}

/**
 * Factory del cron. Devuelve la función que composition-root engancha a setInterval.
 *
 * @param orm            ORM del framework (lee Hotels + Configuration).
 * @param resolveModule  Resolver de módulos (para obtener el service de external-reviews).
 * @param logger         Logger del system.
 * @param fetchers       Las 3 funciones de fetch (gbp/tripadvisor/stayapi).
 * @param cache          CacheAdapter para invalidar el aggregate de opiniones.
 */
export function createExternalReviewsCron(
  orm: any,
  resolveModule: (name: string) => any,
  logger: LoggerLike,
  fetchers: ExternalReviewsFetchers,
  cache: { delete: (key: string) => Promise<unknown> },
): () => Promise<ExternalReviewsCronResult> {
  return async (): Promise<ExternalReviewsCronResult> => {
    const result: ExternalReviewsCronResult = {
      hotelsProcessed: 0, totalInserted: 0, totalUpdated: 0, skippedSources: 0, errors: [],
    }
    try {
      const hotels = (await orm.findMany('Hotels', {})) as any[]
      for (const hotel of hotels) {
        const r = await syncHotelReviews(hotel.id, orm, resolveModule, logger, fetchers, cache)
        // El cron cuenta como "procesado" un hotel que tenía creds Y no falló (regresión
        // F3 3.5: antes de extraer syncHotelReviews, un hotel que reventaba leyendo su
        // Configuration NO se contaba — el refactor lo contaba igual que uno exitoso porque
        // `noCreds` solo cubre "sin creds", no "error". Test: external-reviews-cron.test.ts
        // "error en un hotel → continua con el siguiente").
        if (!r.noCreds && r.errors.length === 0) result.hotelsProcessed++
        result.totalInserted += r.inserted
        result.totalUpdated += r.updated
        result.skippedSources += r.skippedSources
        result.errors.push(...r.errors)
      }
      logger.info('external-reviews-cron completado', { ...result })
    } catch (e: unknown) {
      // Error a nivel cron (ej: orm.findMany('Hotels') cae): log + no rompe el setInterval.
      result.errors.push(`cron-level: ${(e as Error)?.message ?? String(e)}`)
      logger.warn('external-reviews-cron falló', { error: (e as Error)?.message })
    }
    return result
  }
}
