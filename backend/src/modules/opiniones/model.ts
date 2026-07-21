// opiniones/model.ts — Schema de base de datos de reseñas
import type { ModelDefinition, ORM } from 'arckode-framework'

export const OpinionesModel: ModelDefinition = {
  table: 'reviews',
  fields: {
    id: { type: 'string', required: true },
    hotelId: { type: 'string', required: true, indexed: true },
    guestId: { type: 'string' },
    reservationId: { type: 'string' },
    rating: { type: 'number', required: true },
    title: { type: 'string' },
    comment: { type: 'text' },
    response: { type: 'text' },
    date: { type: 'string' },
    visible: { type: 'number', default: 1 },
    channel: { type: 'string', default: 'direct' },
    status: { type: 'string', default: 'visible' }, // visible | pending (invite post-checkout, connector reservas-opiniones)
  },
  timestamps: true,
}

export function registerOpinionesModels(orm: ORM): void {
  orm.define('Reviews', OpinionesModel)
}
