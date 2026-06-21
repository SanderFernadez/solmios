// notificaciones/model.ts — Schema de base de datos
import type { ModelDefinition, ORM } from 'arckode-framework'

export const NotificacionesModel: ModelDefinition = {
  table: 'notifications',
  fields: {
    id: { type: 'string', required: true },
    hotelId: { type: 'string', required: true, indexed: true },
    userId: { type: 'string' },
    type: { type: 'string', default: "system" },
    title: { type: 'string', required: true },
    message: { type: 'text' },
    read: { type: 'number', default: 0 },
    sent: { type: 'number', default: 0 },
    date: { type: 'string' },
    channel: { type: 'string' },
    metadata: { type: 'json' },
  },
  timestamps: true,
}

export function registerNotificacionesModels(orm: ORM): void {
  orm.define('Notifications', NotificacionesModel)
}
