// apikeys/model.ts — Schema de base de datos
import type { ModelDefinition, ORM } from 'arckode-framework'

export const ApikeysModel: ModelDefinition = {
  table: 'api_keys',
  fields: {
    id: { type: 'string', required: true },
    hotelId: { type: 'string', indexed: true },
    name: { type: 'string', required: true },
    scope: { type: 'string' },
    masked: { type: 'string' },
    secretHash: { type: 'string' },
    active: { type: 'number', default: 1 },
    requests: { type: 'number', default: 0 },
    lastUsed: { type: 'string' },
  },
  timestamps: true,
}

export function registerApikeysModels(orm: ORM): void {
  orm.define('Apikeys', ApikeysModel)
}
