// connectors/housekeeping-notificaciones.ts — Wire: housekeeping → notificaciones
// Solo delega. La lógica vive en shared/usecases/notify-task-assigned.

import type { ConnectorContext } from 'arckode-framework'
import {
  notifyTaskAssigned,
  type NotificacionesPort,
  type PushPort,
  type RoomsPort,
} from '../shared/usecases/notify-task-assigned'
import { notifyTaskCompleted, type UsersPort } from '../shared/usecases/notify-task-completed'

export function housekeepingNotificacionesConnector(ctx: ConnectorContext): void {
  const housekeeping = ctx.resolveModule<{ setSockets: (s: any) => void }>('housekeeping')

  /** El número de habitación para el aviso. Sin él, el aviso igual llega. */
  const resolveRooms = (): RoomsPort | null => {
    try { return ctx.resolveModule<RoomsPort>('habitaciones') } catch { return null }
  }
  /** El push para la app cerrada. Si no está (Firebase sin config), solo in-app. */
  const resolvePush = (): PushPort | null => {
    try { return ctx.resolveModule<PushPort>('pushtokens') } catch { return null }
  }

  housekeeping.setSockets({
    onTaskAssigned: async (task: any) => {
      const notificaciones = ctx.resolveModule<NotificacionesPort>('notificaciones')
      await notifyTaskAssigned(notificaciones, resolveRooms(), task, resolvePush())
    },
    // La camarera terminó: avisar al supervisor que hay algo para revisar.
    onTaskCompleted: async (task: any) => {
      const notificaciones = ctx.resolveModule<NotificacionesPort>('notificaciones')
      const users = ctx.resolveModule<UsersPort>('usuarios')
      await notifyTaskCompleted(notificaciones, users, resolveRooms(), task, resolvePush())
    },
  })
}
