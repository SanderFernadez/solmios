// paquetes/model.ts — Schema de base de datos
import type { ModelDefinition, ORM } from 'arckode-framework'

export const PaquetesModel: ModelDefinition = {
  table: 'packages',
  fields: {
    id: { type: 'string', required: true },
    hotelId: { type: 'string', required: true, indexed: true },
    name: { type: 'string', required: true },
    description: { type: 'text' },
    // combo = paquete (habitación + extras) · servicio = extra suelto que se vende aparte.
    type: { type: 'string', default: "combo" },
    price: { type: 'number', required: true },
    contents: { type: 'json', default: [] },
    active: { type: 'number', default: 1 },
    createdAt: { type: 'string' },
  },
  timestamps: true,
}

export function registerPaquetesModels(orm: ORM): void {
  orm.define('Packages', PaquetesModel)
}
