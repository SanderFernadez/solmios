// connectors/mantenimiento-notificaciones.ts — Wire: mantenimiento → notificaciones
// Solo delega eventos, sin lógica de negocio.
import type { ConnectorContext } from 'arckode-framework'

export function mantenimientoNotificacionesConnector(ctx: ConnectorContext): void {
  const mantenimiento = ctx.resolveModule<{ setSockets: (s: any) => void }>('mantenimiento')

  mantenimiento.setSockets({
    onMantenimientoCreated: async (order: any) => {
      const notificaciones = ctx.resolveModule<{ create: (d: any, u: any) => Promise<any> }>('notificaciones')
      const sysUser = { id: 'system', role: 'super_admin', hotelId: order.hotelId }
      await notificaciones.create({
        hotelId: order.hotelId,
        title: 'Nueva orden de mantenimiento',
        message: order.title,
        type: 'maintenance',
        read: 0,
        date: new Date().toISOString(),
      } as any, sysUser)
    },
    onMantenimientoUpdated: async (order: any) => {
      const notificaciones = ctx.resolveModule<{ create: (d: any, u: any) => Promise<any> }>('notificaciones')
      const sysUser = { id: 'system', role: 'super_admin', hotelId: order.hotelId }
      await notificaciones.create({
        hotelId: order.hotelId,
        title: `Orden actualizada: ${order.status}`,
        message: order.title,
        type: 'maintenance',
        read: 0,
        date: new Date().toISOString(),
      } as any, sysUser)
    },
  })
}
