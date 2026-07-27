// platform-emails/model.ts — Plantillas de email de PLATAFORMA (SolmiOS → dueño del hotel).
//
// Distinto de AutoMessages (services/notification-renderer.ts): eso es per-hotel/huésped
// (`hotelId` requerido, dominio guest-facing). Esto es GLOBAL a la plataforma — 1 fila por
// evento del ciclo de vida de la suscripción SaaS (bienvenida, trial, pagos, cancelación).
// Sin UNIQUE físico en `event`: la app garantiza 1 fila por evento vía `findOne({event})` +
// `update`, nunca insert duplicado (mismo criterio pragmático que `AutoMessages.hotelId`,
// que tampoco es UNIQUE).
import type { ModelDefinition, ORM } from 'arckode-framework'

export const PlatformEmailTemplateModel: ModelDefinition = {
  table: 'platform_email_templates',
  timestamps: true,
  fields: {
    id: { type: 'string', required: true },
    /** welcome | trial_ending | trial_expired | payment_succeeded | payment_failed | subscription_canceled */
    event: { type: 'string', required: true, indexed: true },
    subject: { type: 'string' },
    body: { type: 'text' }, // HTML con placeholders {key}
    /** JSON array de los nombres de placeholder disponibles para ESTE evento (hint del frontend). */
    variables: { type: 'text' },
    isActive: { type: 'boolean', default: true },
  },
}

export function registerPlatformEmailsModels(orm: ORM): void {
  orm.define('PlatformEmailTemplate', PlatformEmailTemplateModel)
}
