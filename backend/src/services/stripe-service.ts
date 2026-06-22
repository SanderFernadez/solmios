// backend/src/services/stripe-service.ts
// Servicio Stripe con graceful degradation: si STRIPE_SECRET_KEY no está configurada,
// los métodos devuelven null y los endpoints responden 503 — sin romper la app.

import Stripe from 'stripe'

let client: Stripe | null = null

function getClient(): Stripe | null {
  if (client) return client
  const key = process.env.STRIPE_SECRET_KEY
  if (!key) return null
  client = new Stripe(key, {
    apiVersion: '2025-08-27.basil' as any,
    appInfo: { name: 'ManagerHotel', version: '1.0.0' },
  })
  return client
}

export const isStripeConfigured = (): boolean => !!process.env.STRIPE_SECRET_KEY

export interface CreateCheckoutInput {
  paymentRequestId: string
  amount: number
  currency?: string
  description?: string
  /** URL a la que vuelve el huésped tras pagar */
  successUrl: string
  cancelUrl: string
  /** Email del cliente (opcional, lo pre-llena) */
  customerEmail?: string
  /** Metadata para identificar en webhook */
  metadata?: Record<string, string>
}

export interface CheckoutResult {
  sessionId: string
  sessionUrl: string
}

export const StripeService = {
  isConfigured: isStripeConfigured,

  async createCheckoutSession(input: CreateCheckoutInput): Promise<CheckoutResult> {
    const stripe = getClient()
    if (!stripe) throw new Error('Stripe no configurado')
    const session = await stripe.checkout.sessions.create({
      mode: 'payment',
      payment_method_types: ['card'],
      line_items: [{
        price_data: {
          currency: input.currency || 'usd',
          product_data: { name: input.description || 'Reserva hotelera' },
          unit_amount: Math.round(input.amount * 100),
        },
        quantity: 1,
      }],
      success_url: input.successUrl,
      cancel_url: input.cancelUrl,
      customer_email: input.customerEmail,
      metadata: { paymentRequestId: input.paymentRequestId, ...(input.metadata || {}) },
    })
    return {
      sessionId: session.id,
      sessionUrl: session.url || '',
    }
  },

  /** Verifica firma del webhook — lanza error si inválido */
  async verifyWebhook(rawBody: string | Buffer, signature: string): Promise<Stripe.Event> {
    const stripe = getClient()
    if (!stripe) throw new Error('Stripe no configurado')
    const secret = process.env.STRIPE_WEBHOOK_SECRET
    if (!secret) throw new Error('STRIPE_WEBHOOK_SECRET no configurado')
    return stripe.webhooks.constructEvent(rawBody, signature, secret)
  },

  /** Recupera una sesión por ID (para saber si fue pagada) */
  async getSession(sessionId: string): Promise<Stripe.Checkout.Session | null> {
    const stripe = getClient()
    if (!stripe) return null
    return stripe.checkout.sessions.retrieve(sessionId)
  },
}
