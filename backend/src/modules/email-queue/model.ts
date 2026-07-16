// email-queue/model.ts — Schema de DB (documental).
//
// OJO: la tabla `email_queue` es propiedad de EmailService (servicio transversal), y su modelo
// ORM se registra en `src/shared/models.ts` (registerSharedModels). Este módulo NO lo redefine
// para evitar el anti-patrón de "modelos duales" (último orm.define gana y descarta campos).
// Se deja acá SOLO como referencia del schema que este módulo opera.
import type { ModelDefinition } from 'arckode-framework'

export const EmailQueueModel: ModelDefinition = {
  table: 'email_queue',
  timestamps: true,
  fields: {
    id: { type: 'string', required: true },
    hotelId: { type: 'string', required: true, indexed: true },
    recipient: { type: 'string', required: true },
    subject: { type: 'string', required: true },
    html: { type: 'text', required: true },
    status: { type: 'string', default: 'pending' },
    attempts: { type: 'number', default: 0 },
    maxAttempts: { type: 'number', default: 3 },
    lastError: { type: 'string' },
    nextRetryAt: { type: 'string' },
    provider: { type: 'string' },
    relatedType: { type: 'string' },
    relatedId: { type: 'string' },
  },
}
