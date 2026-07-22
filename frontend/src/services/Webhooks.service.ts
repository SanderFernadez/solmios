import { http } from './http'

export interface WebhookSubscription {
  id: string
  hotelId: string
  url: string
  events: string[]
  masked?: string
  /** Solo se devuelve en creación — jamás se reenvía */
  secret?: string
  active: boolean | number
  delivered: number
  failed: number
  createdAt?: string
}

export interface WebhookCreate {
  hotelId: string
  url: string
  events: string[]
}

export interface WebhookTestResult {
  delivered: boolean
}

export const WebhooksService = {
  list: (hotelId?: string) => http.get<{ data: WebhookSubscription[] }>(`/webhooks${hotelId ? `?hotelId=${hotelId}` : ''}`),
  create: (data: WebhookCreate) => http.post<WebhookSubscription>('/webhooks', data),
  update: (id: string, data: Partial<Pick<WebhookSubscription, 'url' | 'events' | 'active'>>) =>
    http.put<WebhookSubscription>(`/webhooks/${id}`, data),
  test: (id: string) => http.post<WebhookTestResult>(`/webhooks/${id}/test`, {}),
  remove: (id: string) => http.delete<{ success: boolean }>(`/webhooks/${id}`),
}
