// connectors/reservas-huespedes.ts
import type { ConnectorContext } from 'arckode-framework'

export function reservasHuespedesConnector(ctx: ConnectorContext): void {
  const reservas = ctx.resolveModule<{ setSockets: (s: any) => void }>('reservas')

  reservas.setSockets({
    onReservasUpdated: async (reserva: any) => {
      if (reserva.status !== 'checked_out' || !reserva.guestId) return
      const crm = ctx.resolveModule<{ onCheckoutComplete: (reserva: any) => Promise<any> }>('crm')
      if (crm) await crm.onCheckoutComplete(reserva).catch(() => {})
    },
  })
}
