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
    language: { type: 'string' },
    sex: { type: 'string' },
    country: { type: 'string' },
    address: { type: 'string' },
    city: { type: 'string' },
    province: { type: 'string' },
    documentType: { type: 'string' },
    documentUrl: { type: 'string' },
    documentIssueDate: { type: 'string' },
    profession: { type: 'string' },
    emergencyContact: { type: 'json' },
    preferences: { type: 'json' },
    loyaltyPoints: { type: 'number', default: 0 },
    totalStays: { type: 'number', default: 0 },
    totalSpent: { type: 'number', default: 0 },
    tier: { type: 'string', default: "bronze" },
    birthDate: { type: 'string' },
    hotelId: { type: 'string', required: true, indexed: true },
    notes: { type: 'text' },
    active: { type: 'number', default: 1 },
  },
  timestamps: true,
}

export function registerHuespedesModels(orm: ORM): void {
  orm.define('Guests', HuespedesModel)
}
