import { http } from './http'

export interface PaymentRequest {
  id?: string
  hotelId?: string
  reservationId: string
  amount: number
  currency?: string
  stripeSessionId?: string
  stripePaymentUrl?: string
  status: 'pending' | 'paid' | 'expired' | 'cancelled'
  sentTo?: string
  sentVia?: 'email' | 'whatsapp' | 'sms'
  paidAt?: string
  createdAt?: string
  guestName?: string
}

export const PaymentsService = {
  list: (reservationId?: string) =>
    http.get<{ data: PaymentRequest[] }>(`/payment-requests${reservationId ? `?reservationId=${reservationId}` : ''}`),
  create: (data: { reservationId: string; amount: number; currency?: string; sentTo?: string; sentVia?: string }) =>
    http.post<PaymentRequest>('/payment-requests', data),
  update: (id: string, data: Partial<PaymentRequest>) =>
    http.put<PaymentRequest>(`/payment-requests/${id}`, data),
  remove: (id: string) => http.delete<{ success: boolean }>(`/payment-requests/${id}`),
  /** Crea una Checkout Session de Stripe y actualiza el PaymentRequest con la URL */
  createStripeCheckout: (paymentRequestId: string) =>
    http.post<{ url: string; sessionId: string }>(`/payment-requests/${paymentRequestId}/create-checkout`),
  /** Estado de configuración de Stripe (para mostrar/ocultar botones) */
  status: () => http.get<{ configured: boolean; publishableKey: string }>('/stripe/status'),
}
