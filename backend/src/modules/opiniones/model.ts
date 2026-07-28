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
    // F0 (solmi-direct-booking / public-reviews 0.9): timestamp cuando el hotel postea `response`.
    // Seteado por OpinionesService.update() cuando dto.response llega no-vacío. Nullable.
    respondedAt: { type: 'date', nullable: true },
    date: { type: 'string' },
    visible: { type: 'number', default: 1 },
    channel: { type: 'string', default: 'direct' },
    status: { type: 'string', default: 'visible' }, // visible | pending (invite post-checkout, connector reservas-opiniones)
    token: { type: 'string' }, // token público del invite: el huésped responde la reseña sin login (/resena/:token)
    // F0 (solmi-direct-booking / public-reviews 0.9): ID en la fuente externa (GBP/TripAdvisor/StayAPI).
    // Para dedup en F3 ingestión OTA. Unique por (channel, sourceExternalId) vía índice/validación. Nullable.
    sourceExternalId: { type: 'string', nullable: true, indexed: true },
  },
  timestamps: true,
}

export function registerOpinionesModels(orm: ORM): void {
  orm.define('Reviews', OpinionesModel)
}
