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

/**
 * Hasta dónde leyó cada usuario un canal.
 *
 * Los chats 1-a-1 marcan cada mensaje con `isRead`, pero el canal del equipo no
 * puede: un mensaje grupal lo leen N personas en momentos distintos, y `isRead`
 * es un solo booleano por mensaje. Se guarda entonces "hasta cuándo leyó cada
 * uno": los no leídos del grupo son los mensajes posteriores a esa marca.
 */
export const MessageReadsModel: ModelDefinition = {
  table: 'message_reads',
  fields: {
    id: { type: 'string', required: true },
    hotelId: { type: 'string', required: true, indexed: true },
    userId: { type: 'string', required: true, indexed: true },
    /** El canal leído. Para el grupo del hotel: `'team'`. */
    channel: { type: 'string', required: true },
    /** ISO del último momento en que este usuario abrió el canal. */
    lastReadAt: { type: 'string' },
  },
  timestamps: true,
}

export function registerMessagesModels(orm: ORM): void {
  orm.define('Messages', MessagesModel)
  orm.define('MessageReads', MessageReadsModel)
}
