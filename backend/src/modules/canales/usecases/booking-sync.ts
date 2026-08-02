// canales/usecases/booking-sync.ts — Ingesta GLOBAL de bookings OTA (cron, issue #564)
//
// Resuelve el bug multi-tenancy: el feed `GET /booking_revisions/feed` de Channex es GLOBAL
// por cuenta de plataforma (prod: 8 propiedades). El path viejo (`channex.ingestBookings` por
// hotel) asignaba TODAS las revisiones a un solo `cfg.hotelId`. Este usecase trae el feed una
// sola vez y deriva cada revisión al hotel correcto vía `revision.propertyId → channel_config
// .channexPropertyId`.
//
// Diseño:
//  - 1 fetch del feed (no N por hotel).
//  - try/catch POR revisión: un fallo no corta el loop.
//  - propertyId sin mapeo → no se procesa NI se ackea (queda para cuando el hotel sincronice).
//  - dedupe (reserva ya existe) → se ackea igual (drena el feed, evita reprocesar).
//  - ack fallido → error contabilizado, pero no relanza (la revisión vuelve a aparecer).
//
// NO toca service/controller/composition-root/cron-factory: otro agente hace el wiring.

import type { ORM, Logger, RepositoryAdapter } from 'arckode-framework'
import type { ChannexUseCase } from './channex'
import type { CanalesQueries } from './canales-queries'
import type { BookingRevisionDTO } from '../types'
import { mapBookingRevision, applyBookingRevision } from './booking-ingestion'

/** Resultado de una corrida del sync global de bookings. */
export interface BookingSyncResult {
  success: boolean
  /** Cantidad de revisiones traídas en el feed (hasta 50 por página de Channex). */
  feedSize: number
  /** Reservas nuevas creadas. */
  ingested: number
  /** Revisiones ackeadas en Channex (drenadas del feed). */
  acknowledged: number
  /** Revisiones que ya existían (dedupe por externalLocator) — se ackean igual. */
  skipped: number
  /** Revisiones cuyo propertyId no matchea ningún hotel sincronizado — NO se ackean. */
  unmapped: number
  /** Mensajes de error por revisión (un fallo no corta el loop). */
  errors: string[]
}

export interface BookingSyncDeps {
  channex: ChannexUseCase
  queries: CanalesQueries
  orm: ORM
  logger: Logger
  /** Repo de sync_log (opcional — si no se inyecta, se omite la fila de auditoría). */
  syncLogRepo?: RepositoryAdapter<any>
}

/** Límite que devuelve el feed de Channex; si se alcanza, el feed sigue saturado. */
const FEED_PAGE_LIMIT = 50

/**
 * Ingesta el feed GLOBAL de bookings de Channex derivando cada revisión a su hotel.
 * Una corrida = 1 fetch + N resoluciones. Idempotente por `externalLocator` (dedupe dentro
 * de `applyBookingRevision`).
 */
export class BookingSyncUseCase {
  constructor(private readonly deps: BookingSyncDeps) {}

  async run(): Promise<BookingSyncResult> {
    const { channex, orm, logger } = this.deps
    const result: BookingSyncResult = {
      success: true, feedSize: 0, ingested: 0, acknowledged: 0,
      skipped: 0, unmapped: 0, errors: [],
    }

    // 1. Mapa channexPropertyId → hotelId: una fila por hotel con sync habilitado.
    const propMap = await this.buildPropertyMap()

    // 2. Feed global una sola vez (key vacía → channexReq usa la credencial de plataforma).
    let feed: BookingRevisionDTO[]
    try {
      feed = await channex.fetchBookingFeed('')
    } catch (e: any) {
      result.success = false
      result.errors.push(`feed: ${e?.message || String(e)}`)
      await this.logSync(result)
      return result
    }
    result.feedSize = feed.length

    if (feed.length === 0) {
      await this.logSync(result)
      return result
    }

    // 3. Por cada revisión, try/catch aislado.
    for (const rev of feed) {
      try {
        const hotelId = propMap.get(rev.propertyId)
        if (!hotelId) {
          // Sin mapeo: no se procesa NI se ackea — la revisión queda para cuando el hotel sincronice.
          result.unmapped++
          logger.warn('booking-sync: propertyId sin hotel mapeado', { propertyId: rev.propertyId, revisionId: rev.id })
          continue
        }

        const dto = mapBookingRevision(rev, hotelId)
        const applied = await applyBookingRevision({ orm, channex, hotelId, apiKey: '' }, dto)
        if (applied.created) result.ingested++
        else result.skipped++

        // Ack siempre (incluso dedupe): drena el feed para que no vuelva a aparecer.
        const acked = await channex.ackBooking('', rev.id)
        if (acked) result.acknowledged++
        else result.errors.push(`No se pudo ack booking ${rev.uniqueId}`)
      } catch (e: any) {
        result.errors.push(`${rev.uniqueId}: ${e?.message || String(e)}`)
      }
    }

    // 5. Feed saturado: avisa que quedan pendientes para el próximo tick.
    if (result.feedSize >= FEED_PAGE_LIMIT) {
      logger.info('booking-sync: feed saturado (50 revisiones) — quedan pendientes para el próximo tick')
    }

    result.success = result.errors.length === 0
    await this.logSync(result)
    return result
  }

  /** Construye el mapa channexPropertyId → hotelId desde las configs con sync habilitado. */
  private async buildPropertyMap(): Promise<Map<string, string>> {
    const { orm } = this.deps
    const configs = (await orm.findMany('Canales', { syncEnabled: 1 })) as any[]
    const map = new Map<string, string>()
    for (const c of configs || []) {
      if (c.channexPropertyId) map.set(c.channexPropertyId, c.hotelId)
    }
    return map
  }

  /** Fila agregada en sync_log (guard `if syncLogRepo`). Molde: service.ingestBookings:137-144. */
  private async logSync(result: BookingSyncResult): Promise<void> {
    if (!this.deps.syncLogRepo) return
    try {
      await this.deps.syncLogRepo.create({
        id: crypto.randomUUID(),
        hotelId: 'platform',   // cron global: abarca múltiples hoteles
        channel: 'channex',
        action: 'ingest_bookings_cron',
        status: result.success ? 'success' : 'error',
        details: {
          feedSize: result.feedSize,
          ingested: result.ingested,
          acknowledged: result.acknowledged,
          skipped: result.skipped,
          unmapped: result.unmapped,
          errors: result.errors,
        },
        createdAt: new Date().toISOString(),
      })
    } catch { /* el log de auditoría no debe romper el cron */ }
  }
}
