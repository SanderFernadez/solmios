// webhooks/model.ts — Schema de base de datos
// Tablas: WebhookSubscription (config del webhook saliente), WebhookDelivery (historial de envíos)

import type { ModelDefinition, ORM } from 'arckode-framework'

export const WebhookSubscriptionModel: ModelDefinition = {
  table: 'webhook_subscriptions',
  timestamps: true,
  fields: {
    id: { type: 'string', required: true },
    hotelId: { type: 'string', required: true, indexed: true },
    url: { type: 'string', required: true },
    events: { type: 'json', default: [] }, // string[] — nombres de evento (ej. "reservation.created")
    secret: { type: 'string', required: true }, // generado por el servidor, usado para firmar (HMAC-SHA256)
    active: { type: 'number', default: 1 },
  },
}

export const WebhookDeliveryModel: ModelDefinition = {
  table: 'webhook_deliveries',
  timestamps: true,
  fields: {
    id: { type: 'string', required: true },
    webhookId: { type: 'string', required: true, indexed: true },
    event: { type: 'string', required: true },
    statusCode: { type: 'number' },
    success: { type: 'number', default: 0 },
    attemptedAt: { type: 'string', required: true },
  },
}

export function registerWebhooksModels(orm: ORM): void {
  orm.define('WebhookSubscription', WebhookSubscriptionModel)
  orm.define('WebhookDelivery', WebhookDeliveryModel)
}
