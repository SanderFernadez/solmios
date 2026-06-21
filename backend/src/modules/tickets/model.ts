// tickets/model.ts — Schema de base de datos
import type { ModelDefinition, ORM } from 'arckode-framework'

export const TicketsModel: ModelDefinition = {
  table: 'tickets',
  fields: {
    id: { type: 'string', required: true },
    hotelId: { type: 'string', required: true, indexed: true },
    userId: { type: 'string', required: true },
    subject: { type: 'string', required: true },
    category: { type: 'string', default: "technical" },
    priority: { type: 'string', default: "medium" },
    status: { type: 'string', default: "open" },
    description: { type: 'text' },
    assignedTo: { type: 'string' },
    messages: { type: 'json', default: [] },
  },
  timestamps: true,
}

export function registerTicketsModels(orm: ORM): void {
  orm.define('Tickets', TicketsModel)
}
