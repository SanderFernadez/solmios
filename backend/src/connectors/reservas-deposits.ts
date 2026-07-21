// connectors/reservas-deposits.ts — Libera el depósito/garantía al hacer check-out.
// reservas emite onReservationCheckedOut; payments libera los depósitos 'held' de esa reserva.
// Cierra el gap CONFIRMADO "checkout no libera/devuelve el hold": settle-folio-at-checkout
// no tocaba deposits y los endpoints /refund y /release existían pero nadie los llamaba →
// el hold quedaba colgando hasta acción manual.
// Best-effort: si payments no carga o falla, NO rompe el checkout (try/catch).
// Seguro encadenar: reservas COMPONE los sockets, así que este connector no pisa a
// reservas-opiniones ni a reservas-huespedes (CRM), que escuchan el mismo evento.

import type { ConnectorContext } from 'arckode-framework'
import type { DepositDTO } from '../modules/payments/types'

export function reservasDepositsConnector(ctx: ConnectorContext): void {
  const reservas = ctx.resolveModule<{ setSockets: (s: any) => void }>('reservas')
  reservas.setSockets({
    onReservationCheckedOut: async (data: { reservationId: string; hotelId: string }) => {
      try {
        const payments = ctx.resolveModule<{
          releaseHeldDepositsByReservation: (reservationId: string, user?: { id?: string; role?: string }) => Promise<DepositDTO[]>
        }>('payments')
        // Actor de sistema (sin userId): el release lo dispara el checkout, no un usuario del
        // panel — mismo criterio que el webhook de Stripe (queda auditado sin userId). Sin
        // userId, deposits.assertOwnership es no-op, así que el hold se libera igual.
        await payments.releaseHeldDepositsByReservation(data.reservationId)
      } catch {
        // Best-effort: payments puede no estar disponible. No rompe el checkout.
      }
    },
  })
}
