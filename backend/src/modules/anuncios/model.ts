// anuncios/model.ts — Schema de base de datos
import type { ModelDefinition, ORM } from 'arckode-framework'

export const AnunciosModel: ModelDefinition = {
  table: 'announcements',
  fields: {
    id: { type: 'string', required: true },
    hotelId: { type: 'string' },
    authorId: { type: 'string' },
    title: { type: 'string', required: true },
    message: { type: 'text' },
    type: { type: 'string', default: "info" },
    priority: { type: 'string', default: "medium" },
    active: { type: 'number', default: 1 },
    date: { type: 'string' },
  },
  timestamps: true,
}

export function registerAnunciosModels(orm: ORM): void {
  orm.define('Announcements', AnunciosModel)
}
