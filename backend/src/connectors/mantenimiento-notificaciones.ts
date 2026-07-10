// connectors/mantenimiento-notificaciones.ts — Wire: mantenimiento → notificaciones
// Solo delega. La lógica de cada aviso vive en shared/usecases/notify-maintenance.
import type { ConnectorContext } from 'arckode-framework'
import {
  notifyMaintenanceCreated,
  notifyMaintenanceUpdated,
  notifyMaintenanceAssigned,
  type NotificacionesPort,
} from '../shared/usecases/notify-maintenance'

export function mantenimientoNotificacionesConnector(ctx: ConnectorContext): void {
  const mantenimiento = ctx.resolveModule<{ setSockets: (s: any) => void }>('mantenimiento')

  mantenimiento.setSockets({
    onMantenimientoCreated: async (order: any) => {
      await notifyMaintenanceCreated(ctx.resolveModule<NotificacionesPort>('notificaciones'), order)
    },
    onMantenimientoUpdated: async (order: any) => {
      await notifyMaintenanceUpdated(ctx.resolveModule<NotificacionesPort>('notificaciones'), order)
    },
    onMantenimientoAssigned: async (order: any) => {
      await notifyMaintenanceAssigned(ctx.resolveModule<NotificacionesPort>('notificaciones'), order)
    },
  })
}
