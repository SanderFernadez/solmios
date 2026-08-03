// connectors/bookingengine-deposits.ts — Reacciona a cancelaciones del huésped (F5 plan #627).
//
// bookingengine emite onBookingCancelled cuando el huésped auto-cancela desde la página
// pública (POST /api/public/reservations/:id/cancel). Este connector aplica la MISMA lógica
// de depósitos que reservas-deposits.ts en onReservationCancelled:
//   - penalty 0% → release (devuelve garantía completa).
//   - penalty parcial → marca refundAmount pendiente en cada depósito held.
//   - penalty 100% → no-op (el depósito queda held, el hotel retiene).
//   TODO #627: refund real de Stripe pendiente (CLAUDE.md:294) — esto solo MARCA los registros.
//
// Best-effort: si payments no carga o falla, NO rompe la cancelación (try/catch).
// Molde: reservas-deposits.ts (mismo patrón de delegación vía sockets).

import type { ConnectorContext } from 'arckode-framework'
import type { DepositDTO } from '../modules/payments/types'

export function bookingengineDepositsConnector(ctx: ConnectorContext): void {
  const bookingengine = ctx.resolveModule<{ setSockets: (s: any) => void }>('bookingengine')
  bookingengine.setSockets({
    onBookingCancelled: async (data: { reservationId: string; hotelId: string; refundAmount: number; cancellationFee: number; policyApplied: any }) => {
      try {
        const payments = ctx.resolveModule<{
          cancelHeldDepositsByReservation: (reservationId: string, refundAmount: number, cancellationFee: number) => Promise<DepositDTO[]>
        }>('payments')
        // El cálculo de penalidad ya se hizo en public-cancel.ts (F4); acá solo se aplica a depósitos.
        // TODO #627: refund real de Stripe pendiente (CLAUDE.md:294).
        await payments.cancelHeldDepositsByReservation(
          data.reservationId,
          data.refundAmount,
          data.cancellationFee,
        )
      } catch {
        // Best-effort: payments puede no estar disponible. No rompe la cancelación del huésped.
      }
    },
  })
}
