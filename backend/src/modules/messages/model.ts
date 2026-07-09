// messages/model.ts — Schema de base de datos (chat interno del equipo)
import type { ModelDefinition, ORM } from 'arckode-framework'

export const MessagesModel: ModelDefinition = {
  table: 'messages',
  fields: {
    id: { type: 'string', required: true },
    fromUserId: { type: 'string', required: true, indexed: true },
    toUserId: { type: 'string', required: true, indexed: true },
    message: { type: 'text' },
    photoUrl: { type: 'string' },
    isRead: { type: 'boolean', default: false },
    hotelId: { type: 'string', required: true, indexed: true },
  },
  timestamps: true,
}

export function registerMessagesModels(orm: ORM): void {
  orm.define('Messages', MessagesModel)
}
