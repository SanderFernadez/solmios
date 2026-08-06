// connectors/ai-gerente-reservas.ts — Wire: ai-gerente → reservas
//
// La tool `cancel_reservation` del Gerente IA (destructiva: exige `confirmed:true` del gerente)
// hacía `reservationRepo.update(id, { status: 'cancelled' })`: sin política, sin snapshot y sin
// emitir `onReservationCancelled` — el depósito retenido nunca se liberaba. Acá se le inyecta el
// puerto de cancelación REAL, el mismo que usa el panel.
//
// `penaltyMode` va por default (`hotel-policy`): el hotel cancela una reserva propia, mismo
// efecto que hacerlo a mano desde `/panel/reservas`.
//
// El connector SOLO delega; el guard de tenant vive en `reservas/usecases/cancel-system.ts`.

import type { ConnectorContext } from 'arckode-framework'

interface ReservasCancelPort {
  cancelBySystem: (
    id: string,
    input: { hotelId: string; reason?: string },
  ) => Promise<{ ok: boolean; error?: string; message?: string; idempotent?: boolean; refundAmount?: number; cancellationFee?: number }>
}

export function aiGerenteReservasConnector(ctx: ConnectorContext): void {
  const gerente = ctx.resolveModule<{ setReservationCancelPort?: (fn: any) => void }>('ai-gerente')

  gerente.setReservationCancelPort?.(async (reservationId: string, hotelId: string, reason: string) => {
    const reservas = ctx.resolveModule<ReservasCancelPort>('reservas')
    const out = await reservas.cancelBySystem(reservationId, { hotelId, reason })
    return {
      ok: out.ok,
      error: out.ok ? undefined : out.message,
      idempotent: out.idempotent,
      refundAmount: out.refundAmount,
      cancellationFee: out.cancellationFee,
    }
  })
}
