// canales/model.ts — Schema de base de datos
// Describe la tabla `canales_config` (configuración del channel manager por hotel).
// Importado por index.ts → orm.define() para registrar el modelo.

import type { ModelDefinition, ORM } from 'arckode-framework'

// Tabla física de configuración del channel manager (uno por hotel).
export const CanalesModel: ModelDefinition = {
  table: 'channel_config',
  timestamps: true,
  fields: {
    id: { type: 'string', required: true },
    hotelId: { type: 'string', required: true, indexed: true },
    channexPropertyId: { type: 'string' },
    channexApiKey: { type: 'string' },
    syncEnabled: { type: 'number', default: 1 },
    lastSync: { type: 'string' },
    config: { type: 'json', default: {} },
  },
}

export function registerCanalesModels(orm: ORM): void {
  orm.define('Canales', CanalesModel)
}
