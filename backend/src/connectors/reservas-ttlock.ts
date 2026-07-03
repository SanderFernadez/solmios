// connectors/reservas-ttlock.ts — Expira códigos TTLock cuando una reserva hace checkout
import type { ConnectorContext } from 'arckode-framework'

export function reservasTtlockConnector(ctx: ConnectorContext): void {
  const reservas = ctx.resolveModule<{ setSockets: (s: any) => void }>('reservas')
  reservas.setSockets({
    onReservationCheckedOut: async (data: { reservationId: string }) => {
      try {
        const ttlock = ctx.resolveModule<{ expireCodesByReservation: (id: string) => Promise<void> }>('ttlock')
        await ttlock.expireCodesByReservation(data.reservationId)
      } catch {
        // ttlock module may not be registered — that's ok
      }
    },
  })
}
