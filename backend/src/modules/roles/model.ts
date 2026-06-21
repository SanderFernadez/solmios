// roles/model.ts — Schema de base de datos
import type { ModelDefinition, ORM } from 'arckode-framework'

export const RolesModel: ModelDefinition = {
  table: 'roles',
  fields: {
    id: { type: 'string', required: true },
    name: { type: 'string', required: true },
    icon: { type: 'string', default: "👤" },
    color: { type: 'string' },
    system: { type: 'number', default: 0 },
    hotelId: { type: 'string' },
    permissions: { type: 'json', default: [] },
    users: { type: 'number', default: 0 },
  },
  timestamps: true,
}

export function registerRolesModels(orm: ORM): void {
  orm.define('Roles', RolesModel)
}
