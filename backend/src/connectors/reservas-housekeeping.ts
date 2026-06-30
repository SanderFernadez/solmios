// connectors/reservas-housekeeping.ts — Conector entre módulos
// Cuando una reserva se actualiza (check-out), dispara una tarea de housekeeping.
// Los conectores orquestan módulos SIN que estos se importen entre sí (regla del framework).

import type { ConnectorContext } from 'arckode-framework'

export function reservasHousekeepingConnector(ctx: ConnectorContext): void {
  const reservas = ctx.resolveModule<{ setSockets: (s: any) => void }>('reservas')

  reservas.setSockets({
    onReservasUpdated: async (reserva: any) => {
      // Al hacer check-out, el módulo de housekeeping reacciona creando una tarea de limpieza.
      // El conector traduce el evento del módulo reservas → acción del módulo housekeeping.
      // El frontend envía 'checked_out' (no 'check_out') — máquina de estados de Reservations.
      if (reserva.status === 'checked_out') {
        const housekeeping = ctx.resolveModule<{ create: (d: any, u: any) => Promise<any> }>('housekeeping')
        // currentUser de sistema: el conector actúa en nombre del sistema (no hay req.user).
        // housekeeping.create requiere currentUser para el check de multi-tenancy — sin él,
        // lanza TypeError (era la causa del 500 al hacer check-out). role super_admin salta el
        // check; dto.hotelId ya es el correcto (el de la reserva).
        await housekeeping.create({
          id: crypto.randomUUID(),
          roomId: reserva.roomId,
          hotelId: reserva.hotelId,
          type: 'full_cleaning',
          priority: 'high',
          status: 'pending',
        } as any, { id: 'system-connector', role: 'super_admin', hotelId: reserva.hotelId })
      }
    },
  })
}
