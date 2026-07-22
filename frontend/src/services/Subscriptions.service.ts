// services/Subscriptions.service.ts — el hotel paga a la plataforma (Stripe Billing).
//
// La LECTURA del estado de la suscripción ya existe en Signup.service.ts (mySubscription(),
// GET /subscription/me) y no se duplica acá: este service solo agrega las dos ACCIONES nuevas
// (checkout/portal), ambas Stripe Checkout/Billing Portal — el navegador redirige a `url`.
import { http } from './http'

export interface StripeRedirect {
  url: string
}

export const SubscriptionsService = {
  /** Arranca el pago del plan elegido: Stripe Checkout Session (mode: subscription). */
  checkout: (planId: string) => http.post<StripeRedirect>('/subscriptions/checkout', { planId }),
  /** Gestionar método de pago / ver facturas: Stripe Billing Portal. */
  portal: () => http.post<StripeRedirect>('/subscriptions/portal', {}),
}
