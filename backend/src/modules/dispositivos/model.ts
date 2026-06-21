// dispositivos/model.ts — Schema de base de datos
import type { ModelDefinition, ORM } from 'arckode-framework'

export const DispositivosModel: ModelDefinition = {
  table: 'devices',
  fields: {
    id: { type: 'string', required: true },
    hotelId: { type: 'string', indexed: true },
    userId: { type: 'string' },
    userName: { type: 'string' },
    device: { type: 'string' },
    icon: { type: 'string', default: "🖥️" },
    browser: { type: 'string' },
    os: { type: 'string' },
    ip: { type: 'string' },
    isMobile: { type: 'number', default: 0 },
    lastActivity: { type: 'string' },
  },
  timestamps: true,
}

export function registerDispositivosModels(orm: ORM): void {
  orm.define('Devices', DispositivosModel)
}
