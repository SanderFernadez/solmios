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
    /** Huella de los permisos que escribió `scripts/sync-system-roles.ts`. Si los permisos actuales
     *  ya no hashean a este valor, alguien los personalizó y el sync no los pisa. */
    defaultsHash: { type: 'string' },
    users: { type: 'number', default: 0 },
  },
  timestamps: true,
}

export function registerRolesModels(orm: ORM): void {
  orm.define('Roles', RolesModel)
}
