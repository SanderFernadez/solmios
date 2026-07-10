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
    // Pausa: `pausedAt` marca desde cuándo está pausada (null = corriendo);
    // `pausedSeconds` acumula el tiempo pausado. La duración real descuenta esto.
    pausedAt: { type: 'string' },
    pausedSeconds: { type: 'number', default: 0 },
    photos: { type: 'json', default: [] },
    // Supervisor approval workflow (F3). Sin estos campos el ORM los descarta
    // silenciosamente (anti-patrón mem 1805) y approve() nunca pasa su gate.
    supervisorId: { type: 'string' },
    supervisorNote: { type: 'text' },
    supOnSiteTime: { type: 'string' },
  },
  timestamps: true,
}

export function registerHousekeepingModels(orm: ORM): void {
  orm.define('Housekeeping', HousekeepingModel)
}
