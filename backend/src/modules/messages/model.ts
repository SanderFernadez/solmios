import type { ModelDefinition, ORM } from 'arckode-framework'

export const MessagesModel: ModelDefinition = {
  table: 'messages',
  fields: {
    id: { type: 'string', required: true },
    fromuserid: { type: 'string', required: true, indexed: true },
    touserid: { type: 'string', required: true, indexed: true },
    message: { type: 'text' },
    photourl: { type: 'string' },
    isread: { type: 'integer', default: 0 },
    hotelid: { type: 'string', required: true, indexed: true },
  },
  timestamps: true,
}

export function registerMessagesModels(orm: ORM): void {
  orm.define('Messages', MessagesModel)
}
