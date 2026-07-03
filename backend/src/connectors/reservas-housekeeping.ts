// connectors/reservas-housekeeping.ts — Conector entre módulos
// Cuando una reserva se hace check-out, el conector dispara la actualización de
// la habitación (status → cleaning) y la creación de la tarea de housekeeping.
// Los conectores orquestan módulos SIN que estos se importen entre sí (regla del framework).

import type { ConnectorContext } from 'arckode-framework'

export function reservasHousekeepingConnector(ctx: ConnectorContext): void {
  const reservas = ctx.resolveModule<{ setSockets: (s: any) => void }>('reservas')

  reservas.setSockets({
    onReservationCheckedOut: async (data: { reservationId: string; roomId: string; hotelId: string }) => {
      const habitaciones = ctx.resolveModule<{ update: (id: string, dto: any, user: any) => Promise<any> }>('habitaciones')
      await habitaciones.update(data.roomId, { status: 'cleaning' } as any, { id: 'system-connector', role: 'super_admin', hotelId: data.hotelId })
      const housekeeping = ctx.resolveModule<{ create: (d: any, u: any) => Promise<any> }>('housekeeping')
      await housekeeping.create({
        id: crypto.randomUUID(), roomId: data.roomId, hotelId: data.hotelId,
        type: 'full_cleaning', priority: 'high', status: 'pending',
      } as any, { id: 'system-connector', role: 'super_admin', hotelId: data.hotelId })
    },
  })
}
