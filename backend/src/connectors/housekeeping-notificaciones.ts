// connectors/housekeeping-notificaciones.ts — Wire: housekeeping → notificaciones
// Solo delega. La lógica vive en shared/usecases/notify-task-assigned.

import type { ConnectorContext } from 'arckode-framework'
import {
  notifyTaskAssigned,
  type NotificacionesPort,
  type PushPort,
  type RoomsPort,
} from '../shared/usecases/notify-task-assigned'

export function housekeepingNotificacionesConnector(ctx: ConnectorContext): void {
  const housekeeping = ctx.resolveModule<{ setSockets: (s: any) => void }>('housekeeping')

  housekeeping.setSockets({
    onTaskAssigned: async (task: any) => {
      const notificaciones = ctx.resolveModule<NotificacionesPort>('notificaciones')
      let rooms: RoomsPort | null = null
      try {
        rooms = ctx.resolveModule<RoomsPort>('habitaciones')
      } catch {
        // Sin el número, el aviso igual llega: es peor no avisar.
      }
      // El push para la app cerrada. Si no está (Firebase sin config), se
      // manda solo el aviso in-app.
      let push: PushPort | null = null
      try {
        push = ctx.resolveModule<PushPort>('pushtokens')
      } catch {
        // Sin push.
      }
      await notifyTaskAssigned(notificaciones, rooms, task, push)
    },
  })
}
