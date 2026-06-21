// housekeeping/model.ts — Schema de base de datos
import type { ModelDefinition, ORM } from 'arckode-framework'

export const HousekeepingModel: ModelDefinition = {
  table: 'housekeeping',
  fields: {
    id: { type: 'string', required: true },
    roomId: { type: 'string', required: true },
    hotelId: { type: 'string', required: true, indexed: true },
    staffId: { type: 'string' },
    type: { type: 'string', default: "full_cleaning" },
    priority: { type: 'string', default: "medium" },
    status: { type: 'string', default: "pending" },
    notes: { type: 'text' },
    assignedDate: { type: 'string' },
    completedDate: { type: 'string' },
    cleaningItems: { type: 'json' },
  },
  timestamps: true,
}

export function registerHousekeepingModels(orm: ORM): void {
  orm.define('Housekeeping', HousekeepingModel)
}
