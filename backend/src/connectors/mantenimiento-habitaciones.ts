// connectors/mantenimiento-habitaciones.ts — Wire: mantenimiento → habitaciones
import type { ConnectorContext } from 'arckode-framework'

const STATUS_MAP: Record<string, string> = {
  closed: 'cleaning',
  in_progress: 'out_of_order',
}

export function mantenimientoHabitacionesConnector(ctx: ConnectorContext): void {
  const mantenimiento = ctx.resolveModule<{ setSockets: (s: any) => void }>('mantenimiento')

  mantenimiento.setSockets({
    onMantenimientoUpdated: async (order: any) => {
      if (!order.roomId) return
      const roomStatus = STATUS_MAP[order.status]
      if (!roomStatus) return
      const habitaciones = ctx.resolveModule<{ update: (id: string, dto: any, user: any) => Promise<any> }>('habitaciones')
      await habitaciones.update(order.roomId, { status: roomStatus }, { id: 'system', role: 'super_admin', hotelId: order.hotelId })
    },
  })
}
