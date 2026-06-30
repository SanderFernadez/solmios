// housekeeping/model.ts — Schema de base de datos
import type { ModelDefinition, ORM } from 'arckode-framework'

export const HousekeepingModel: ModelDefinition = {
  table: 'housekeeping',
  fields: {
    id: { type: 'string', required: true },
    roomId: { type: 'string', required: true },
    hotelId: { type: 'string', required: true, indexed: true },
    staffId: { type: 'string', indexed: true },
    type: { type: 'string', default: "full_cleaning" },
    priority: { type: 'string', default: "medium" },
    status: { type: 'string', default: "pending", indexed: true },
    notes: { type: 'text' },
    assignedDate: { type: 'string' },
    completedDate: { type: 'string' },
    cleaningItems: { type: 'json' },
    // Timings + evidencia fotográfica (F2). duration NO se persiste: se calcula en runtime
    // como endTime - startTime (D1 del plan: evitar doble fuente de verdad).
    startTime: { type: 'string' },
    endTime: { type: 'string', indexed: true },
    photos: { type: 'json', default: [] },
  },
  timestamps: true,
}

export function registerHousekeepingModels(orm: ORM): void {
  orm.define('Housekeeping', HousekeepingModel)
}
