// webhooks/types.ts — DTOs y tipos de queries
// El schema de DB vive en ./model.ts — son conceptos distintos (2 tablas: subscriptions/deliveries).

export interface WebhookSubscriptionDTO {
  id: string
  hotelId: string
  url: string
  events: string[]
  /** Nunca se expone completo fuera de `create` (una sola vez) — ver usecases/secret.ts stripSecret. */
  secret?: string
  active?: number
  createdAt: string
  updatedAt: string
}

/** Vista pública de una subscription: sin `secret`, con contadores de entregas (para la UI). */
export interface WebhookSubscriptionView extends Omit<WebhookSubscriptionDTO, 'secret'> {
  masked: string
  delivered: number
  failed: number
}

export interface CreateWebhookSubscriptionDTO {
  hotelId: string
  url: string
  events: string[]
  active?: number
}

export interface UpdateWebhookSubscriptionDTO {
  url?: string
  events?: string[]
  active?: number
}

export interface WebhookSubscriptionsQuery {
  hotelId?: string
  active?: number
  page?: number
  limit?: number
}

export interface WebhookSubscriptionsPaginated {
  data: WebhookSubscriptionView[]
  total: number
  page?: number
  limit?: number
  pages?: number
}

export interface WebhookDeliveryDTO {
  id: string
  webhookId: string
  event: string
  statusCode?: number
  success?: number
  attemptedAt: string
  createdAt: string
  updatedAt: string
}

export type CurrentUser = { id: string; role: string; hotelId?: string }
