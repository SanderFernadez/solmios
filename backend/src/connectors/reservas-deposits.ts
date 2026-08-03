// connectors/reservas-deposits.ts — Libera/marca el depósito/garantía al check-out o cancelación.
//
// onReservationCheckedOut: payments libera los depósitos 'held' de esa reserva.
//   Cierra el gap CONFIRMADO "checkout no libera/devuelve el hold": settle-folio-at-checkout
//   no tocaba deposits y los endpoints /refund y /release existían pero nadie los llamaba →
//   el hold quedaba colgando hasta acción manual.
//
// onReservationCancelled (F5 plan #627): payments marca/libera los depósitos según la penalidad.
//   - penalty 0% → release (devuelve garantía completa, mismo camino que checkout).
//   - penalty parcial → marca refundAmount pendiente en cada depósito held.
//   - penalty 100% → no-op (el depósito queda held, el hotel retae).
//   TODO #627: refund real de Stripe pendiente (CLAUDE.md:294) — esto solo MARCA los registros.
//
// Best-effort en ambos casos: si payments no carga o falla, NO rompe la operación (try/catch).
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
    onReservationCancelled: async (data: { reservationId: string; hotelId: string; refundAmount: number; cancellationFee: number; policyApplied: any }) => {
      try {
        const payments = ctx.resolveModule<{
          cancelHeldDepositsByReservation: (reservationId: string, refundAmount: number, cancellationFee: number) => Promise<DepositDTO[]>
        }>('payments')
        // El cálculo de penalidad ya se hizo en cancel.ts (F2); acá solo se aplica a depósitos.
        // TODO #627: refund real de Stripe pendiente (CLAUDE.md:294).
        await payments.cancelHeldDepositsByReservation(
          data.reservationId,
          data.refundAmount,
          data.cancellationFee,
        )
      } catch {
        // Best-effort: payments puede no estar disponible. No rompe la cancelación.
      }
    },
  })
}
