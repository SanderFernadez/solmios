// activos/model.ts — Schema de base de datos (bienes/activos asignables a empleados).
import type { ModelDefinition, ORM } from 'arckode-framework'

export const AssetModel: ModelDefinition = {
  table: 'assets',
  fields: {
    hotelId: { type: 'string', required: true, indexed: true },
    name: { type: 'string', required: true },
    category: { type: 'string', required: true, default: 'other' }, // uniform | key | equipment | device | other
    serialNumber: { type: 'string' },
    status: { type: 'string', required: true, default: 'available' }, // available | assigned | retired
    assignedTo: { type: 'string', indexed: true }, // employee_profiles.id, null si está disponible
    assignedAt: { type: 'string' },
    notes: { type: 'string' },
  },
  timestamps: true,
}

export function registerActivosModels(orm: ORM): void {
  orm.define('Asset', AssetModel)
}
