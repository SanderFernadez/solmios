// shared/usecases/abandon-recovery-cron.ts — Cron de recuperación de reservas (F3, task 3.14).
//
// Schedule: cada 30 min (configurable). Corrida inicial a los 10s (anti-restart, mismo
// molde que night-audit / external-reviews / currency-rates / referral-credits).
//
// Idempotencia (spec.md acceptance): el flag `abandonEmailSent` en `reservations` evita
// re-enviar el email. Solo se marca si el encolado tuvo éxito (si EmailService.enqueue
// tira o devuelve sent=false, el flag queda en false y el próximo tick reintenta).
//
// Resiliencia:
//   - Por reserva: try/catch en el service (un huésped sin email no rompe el batch).
//   - Por sweep: try/catch acá outer → log warn, no tira el setInterval de composition-root.
//
// Anti-patrón ORM: el flag está declarado en `ReservasModel` (reservas/model.ts:64-67) y
// migrado con `addColumnIfMissing` en migrate-db.ts. Si se omite la declaración, el ORM
// descarta el campo en `update()` y el cron manda el email infinitamente (mem 1805).

import type { Logger } from 'arckode-framework'
import type { AbandonRecoveryService } from '../../modules/abandon-recovery/service'
import type { AbandonSweepResult } from '../../modules/abandon-recovery/types'

/** Tick del cron: 30 min (la ventana de abandono va de 1h a 4h, así que 30 min de resolución
 *  da hasta 6 oportunidades de recuperar una reserva antes de que salga de la ventana). */
export const ABANDON_RECOVERY_TICK_MS = 30 * 60 * 1000

/**
 * Factory: devuelve la función que composition-root engancha a setInterval.
 *
 * @param service           AbandonRecoveryService ya construido (con sus repos + email cableados).
 * @param logger            Logger del system.
 */
export function createAbandonRecoveryCron(
  service: AbandonRecoveryService,
  logger: Logger,
): () => Promise<AbandonSweepResult> {
  return async (): Promise<AbandonSweepResult> => {
    try {
      const result = await service.runSweep()
      if (result.emailed > 0) {
        logger.info('abandon-recovery-cron: emails encolados', {
          scanned: result.scanned,
          emailed: result.emailed,
          skipped: result.skipped,
          errors: result.errors.length,
        })
      } else if (result.scanned > 0) {
        logger.warn('abandon-recovery-cron: scan con 0 emails encolados', { ...result })
      }
      return result
    } catch (e: unknown) {
      // Cron-level error (ej: orm caído): log + no rompe el setInterval.
      logger.warn('abandon-recovery-cron falló', { error: (e as Error)?.message ?? String(e) })
      return { scanned: 0, emailed: 0, skipped: 0, errors: [{ reservationId: '-', reason: `cron-level: ${(e as Error)?.message ?? String(e)}` }] }
    }
  }
}
