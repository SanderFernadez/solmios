// payment-requests/types.ts — Contratos de API (no de BD). model.ts describe la tabla.

export type PaymentRequestStatus = 'pending' | 'paid' | 'expired' | 'cancelled'

export interface PaymentRequestDTO {
  id: string
  hotelId: string
  reservationId: string
  amount: number
  currency?: string
  stripeSessionId?: string
  stripePaymentUrl?: string
  status: PaymentRequestStatus | string
  sentTo?: string
  sentVia?: string
  paidAt?: string
  createdAt?: string
  updatedAt?: string
}

export interface CreatePaymentRequestDTO {
  hotelId?: string
  reservationId: string
  amount: number
  currency?: string
  sentTo?: string
  sentVia?: string
}

export interface UpdatePaymentRequestDTO {
  amount?: number
  status?: string
  stripeSessionId?: string
  stripePaymentUrl?: string
  sentTo?: string
  sentVia?: string
  paidAt?: string
}

export interface PaymentRequestQuery {
  hotelId?: string
  reservationId?: string
}

/** Usuario autenticado extraído del JWT. */
export interface CurrentUser {
  id: string
  hotelId?: string
  role: string
}

export interface StripeStatusResult {
  configured: boolean
  publishableKey: string
  currency: string
}

export interface CheckoutResult {
  url: string
  sessionId: string
}

export interface WebhookResult {
  received?: boolean
  error?: string
  detail?: string
}
