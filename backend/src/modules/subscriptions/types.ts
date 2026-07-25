// types.ts — Contratos de la API de suscripciones (distinto de model.ts, que es la BD).

/** Estado del vínculo del hotel con la plataforma. `suspended` = gracia agotada sin pagar, bloquea el panel. */
export type SubscriptionStatus = 'trialing' | 'active' | 'past_due' | 'expired' | 'canceled' | 'suspended'

/** Categoría especial con cupo limitado (Fundador Uno/Dos, Pionero). Ver `special_category_config`. */
export type SpecialCategoryKey = 'founder_one' | 'founder_two' | 'pioneer'

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
  specialCategory?: SpecialCategoryKey | null
  specialCategoryGrantedAt?: string
  isRecurring?: boolean
  graceEndsAt?: string
  suspendedAt?: string
  suspendedReason?: 'grace_period_expired' | 'manual'
  renewalReminderSentAt?: string
  createdAt?: string
  updatedAt?: string
}

/** Por qué un hotel no puede operar (`MySubscriptionDTO.reason`). */
export type SubscriptionDenyReason =
  | 'trial_expired' | 'subscription_expired' | 'hotel_suspended' | 'hotel_inactive' | 'subscription_suspended'

/** Lo que ve el hotel sobre su propia suscripción. */
export interface MySubscriptionDTO {
  status: SubscriptionStatus | 'none'
  trialEndsAt: string | null
  currentPeriodEnd: string | null
  planId: string
  allowed: boolean
  /** Por qué no puede operar, si es el caso. */
  reason: SubscriptionDenyReason | string | null
  /** Días que faltan para que se venza la prueba. */
  daysLeft: number | null
  /** Ya tiene un Customer de Stripe (pagó al menos una vez) → puede abrir el Billing Portal. */
  hasStripeCustomer: boolean
  /** Categoría especial activa, si tiene. */
  specialCategory: SpecialCategoryKey | null
  /** Descuento activo (el mayor `discountPct` entre las filas `subscription_discounts` vigentes), si tiene. */
  activeDiscountPct: number | null
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
