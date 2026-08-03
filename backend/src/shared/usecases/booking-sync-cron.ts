// shared/usecases/booking-sync-cron.ts — Cron de ingesta GLOBAL de bookings OTA (issue #564).
//
// Mismo molde que night-audit-cron: factory + resolveModule + catch externo que NO propaga
// (un cron no debe tirar el server). El feed de Channex es por cuenta de plataforma (no por
// hotel); el usecase del módulo canales deriva cada revisión a su hotel vía propertyId.
//
// Sin creds de Channex → fetchBookingFeed falla → el usecase retorna errors + success=false,
// pero NO rompe: el cron loguea y sigue. En el próximo tick, si ya hay creds, reintenta.

import type { Logger } from 'arckode-framework'
import type { BookingSyncResult } from '../../modules/canales/usecases/booking-sync'

/** Tick por defecto: cada 15 min. Configurable vía env BOOKING_SYNC_INTERVAL_MS. */
export const DEFAULT_BOOKING_SYNC_TICK_MS = 60_000 * 15

const ZERO_RESULT: BookingSyncResult = {
  success: false, feedSize: 0, ingested: 0, acknowledged: 0,
  skipped: 0, unmapped: 0, suspended: 0, errors: [],
}

/**
 * Crea el cron de sync global de bookings OTA.
 * `_orm` se mantiene en la firma por simetría con night-audit-cron (el usecase ya recibe el orm
 * del service; acá no se necesita). Retorna siempre un BookingSyncResult (nunca throws).
 */
export function createBookingSyncCron(
  _orm: any,
  resolveModule: (name: string) => any,
  logger: Logger,
): () => Promise<BookingSyncResult> {
  return async (): Promise<BookingSyncResult> => {
    try {
      const canales = resolveModule('canales')
      if (!canales || !canales.syncAllBookingRevisions) {
        logger.warn('booking-sync-cron: módulo canales no disponible')
        return { ...ZERO_RESULT }
      }
      const result = await canales.syncAllBookingRevisions()
      logger.info('booking-sync-cron completado', result)
      return result
    } catch (e: any) {
      logger.warn('booking-sync-cron falló', { error: e?.message || String(e) })
      return { ...ZERO_RESULT }
    }
  }
}
