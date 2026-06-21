// mantenimiento/model.ts — Schema de base de datos
import type { ModelDefinition, ORM } from 'arckode-framework'

export const MantenimientoModel: ModelDefinition = {
  table: 'maintenance',
  fields: {
    id: { type: 'string', required: true },
    hotelId: { type: 'string', required: true, indexed: true },
    roomId: { type: 'string' },
    roomNumber: { type: 'string' },
    title: { type: 'string', required: true },
    description: { type: 'text' },
    category: { type: 'string', default: "general" },
    priority: { type: 'string', default: "medium" },
    status: { type: 'string', default: "open" },
    assignedTo: { type: 'string' },
    estimatedCost: { type: 'number', default: 0 },
    reportedDate: { type: 'string' },
    resolvedDate: { type: 'string' },
  },
  timestamps: true,
}

export function registerMantenimientoModels(orm: ORM): void {
  orm.define('Maintenance', MantenimientoModel)
}
