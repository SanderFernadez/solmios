// connectors/reservas-canales.ts — Conector entre módulos
// Cuando una reserva se crea/actualiza/cancela (vía el MÓDULO reservas), recalcula y
// empuja availability a Channex. Los handlers custom (check-in/checkout/booking público/
// bloqueos) bypassan el módulo y disparan pushAvailabilityByRoom inline en composition-root.
// Regla del framework: conectores orquestan módulos SIN que estos se importen entre sí.

import type { ConnectorContext } from 'arckode-framework'

export function reservasCanalesConnector(ctx: ConnectorContext): void {
  const reservas = ctx.resolveModule<{ setSockets: (s: any) => void }>('reservas')

  reservas.setSockets({
    // create → reserva nueva ocupa noches → availability baja.
    onReservasCreated: async (reserva: any) => {
      const canales = ctx.resolveModule<{ pushAvailabilityByRoom: (h: string, r: string) => Promise<{ pushed: boolean }> }>('canales')
      await canales.pushAvailabilityByRoom(reserva.hotelId, reserva.roomId).catch(() => {})
    },
    // update → cubre cancelación (status='cancelled' libera noches) y cambios de fecha/room.
    onReservasUpdated: async (reserva: any) => {
      const canales = ctx.resolveModule<{ pushAvailabilityByRoom: (h: string, r: string) => Promise<{ pushed: boolean }> }>('canales')
      await canales.pushAvailabilityByRoom(reserva.hotelId, reserva.roomId).catch(() => {})
    },
    // onDelete solo recibe id (sin hotelId/roomId) → no se puede recalcular selectivo.
    // Las cancelaciones reales son soft (status='cancelled' → onReservasUpdated, cubierto arriba).
    // El delete físico es raro; la availability se corrige en el siguiente push o sync.
    onReservasDeleted: async () => {},
  })
}
