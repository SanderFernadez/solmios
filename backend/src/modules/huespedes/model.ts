// huespedes/model.ts — Schema de base de datos
import type { ModelDefinition, ORM } from 'arckode-framework'

export const HuespedesModel: ModelDefinition = {
  table: 'guests',
  fields: {
    id: { type: 'string', required: true },
    name: { type: 'string', required: true },
    email: { type: 'string' },
    phone: { type: 'string' },
    document: { type: 'string' },
    nationality: { type: 'string' },
    preferences: { type: 'json' },
    totalStays: { type: 'number', default: 0 },
    totalSpent: { type: 'number', default: 0 },
    tier: { type: 'string', default: "bronze" },
    hotelId: { type: 'string', required: true, indexed: true },
    notes: { type: 'text' },
    active: { type: 'number', default: 1 },
  },
  timestamps: true,
}

export function registerHuespedesModels(orm: ORM): void {
  orm.define('Guests', HuespedesModel)
}
