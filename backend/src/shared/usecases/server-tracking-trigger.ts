// shared/usecases/server-tracking-trigger.ts — Helper de disparo de tracking post-confirm (F3 3.12).
//
// Extrae la lógica de "resolver el módulo + llamar fireAll sin bloquear" fuera del connector
// `bookingengine-tracking.ts`, que así queda como puro wiring (analyzer regla: "los conectores
// solo deben wirear"). El helper vive en `shared/usecases/` porque NO es lógica del módulo
// server-tracking — es orquestación cross-module (pertenece al composition layer).
//
// Fire-and-forget: el webhook tiene que responder rápido (spec.md "Rate-limit / queue" →
// "el webhook responde rápido, los fires se procesan async"). El service.persistStatus
// hace el ciclo sent/failed/skipped por su cuenta.
import type { ConnectorContext } from 'arckode-framework'

/**
 * Devuelve el handler del socket `onBookingPaid`. Fire-and-forget: programa el fire
 * sin await y catch terminal por si todo el service crashea (no propaga al webhook).
 */
export function fireAllAfterBookingPaid(ctx: ConnectorContext) {
  return async (data: { id?: string } | { id: string }): Promise<void> => {
    const reservationId = (data as { id?: string })?.id
    if (!reservationId) return
    const tracking = ctx.resolveModule<{ fireAll(reservationId: string): Promise<unknown> }>('server-tracking')
    if (!tracking?.fireAll) return
    // `void` + `.catch` marca intención fire-and-forget. El webhook no espera este fire.
    void tracking.fireAll(reservationId).catch((e) => {
      console.error('[bookingengine-tracking] fireAll failed', e)
    })
  }
}
