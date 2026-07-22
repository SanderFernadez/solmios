// types.ts — Contratos de la API de suscripciones (distinto de model.ts, que es la BD).

/** Estado del vínculo del hotel con la plataforma. */
export type SubscriptionStatus = 'trialing' | 'active' | 'past_due' | 'expired' | 'canceled'

export interface SubscriptionDTO {
  id: string
  hotelId: string
  planId?: string
  status: SubscriptionStatus
  trialEndsAt?: string
  currentPeriodEnd?: string
  canceledAt?: string
  stripeCustomerId?: string
  stripeSubscriptionId?: string
  createdAt?: string
  updatedAt?: string
}

/** Lo que ve el hotel sobre su propia suscripción. */
export interface MySubscriptionDTO {
  status: SubscriptionStatus | 'none'
  trialEndsAt: string | null
  currentPeriodEnd: string | null
  planId: string
  allowed: boolean
  /** Por qué no puede operar, si es el caso. */
  reason: string | null
  /** Días que faltan para que se venza la prueba. */
  daysLeft: number | null
  /** Ya tiene un Customer de Stripe (pagó al menos una vez) → puede abrir el Billing Portal. */
  hasStripeCustomer: boolean
}

/** Respuesta de /subscriptions/checkout y /subscriptions/portal: a dónde redirigir al hotel. */
export interface StripeRedirectDTO {
  url: string
}

/** Plan tal como lo ve alguien que todavía no es cliente. */
export interface PublicPlanDTO {
  id: string
  name: string
  slug: string
  price: number
  currency: string
  description: string
  features: string[]
}
