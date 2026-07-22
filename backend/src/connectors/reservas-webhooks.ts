// connectors/reservas-webhooks.ts — reservas emite sus sockets (ver modules/reservas/sockets.ts,
// eventos reales confirmados: `onReservasCreated`, `onReservasUpdated`, `onReservasDeleted`,
// `onReservationCheckedOut`) → se traducen a eventos de webhook saliente para el hotel dueño de
// la reserva. Mismo patrón que cualquier otro connector (ej. reservas-housekeeping.ts): SOLO
// delega, sin lógica propia. `webhooks.dispatch()` es best-effort — nunca puede tumbar reservas.

import type { ConnectorContext } from 'arckode-framework'

interface WebhooksPort { dispatch: (hotelId: string, event: string, payload: unknown) => Promise<void> }

export function reservasWebhooksConnector(ctx: ConnectorContext): void {
  const reservas = ctx.resolveModule<{ setSockets: (s: any) => void }>('reservas')
  const webhooks = ctx.resolveModule<WebhooksPort>('webhooks')

  reservas.setSockets({
    onReservasCreated: async (data: any) => {
      await webhooks.dispatch(data.hotelId, 'reservation.created', data)
    },
    onReservasUpdated: async (data: any) => {
      await webhooks.dispatch(data.hotelId, 'reservation.updated', data)
    },
    // onReservasDeleted no se engancha: el payload del socket es solo el `id` (sin hotelId), y
    // reservas rara vez se borran (regla "anular ≠ borrar" — ver CLAUDE.md). Sin tenant al que
    // avisar, más vale omitir que adivinar.
    onReservationCheckedOut: async (data: any) => {
      await webhooks.dispatch(data.hotelId, 'reservation.checked_out', data)
    },
  })
}
