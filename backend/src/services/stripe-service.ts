// backend/src/services/stripe-service.ts
// Servicio Stripe con graceful degradation: si no hay keys configuradas (ni por hotel ni en env),
// los métodos devuelven null / lanzan error y los endpoints responden 503 — sin romper la app.
//
// Keys por hotel: composition-root inyecta un configResolver que lee configuration['stripe_config'].
// Fallback a process.env.STRIPE_* (cuenta global). Así cada hotel puede conectar su propia cuenta,
// o usar la global.

import Stripe from 'stripe'

export interface StripeConfig {
  secretKey?: string
  publishableKey?: string
  webhookSecret?: string
  currency?: string
}

type ConfigResolver = (hotelId?: string) => Promise<StripeConfig | null>

let resolver: ConfigResolver | null = null
const clients = new Map<string, Stripe>() // cache por hotelId (+ '__global__')

function envConfig(): StripeConfig {
  return {
    secretKey: process.env.STRIPE_SECRET_KEY,
    publishableKey: process.env.STRIPE_PUBLISHABLE_KEY,
    webhookSecret: process.env.STRIPE_WEBHOOK_SECRET,
    currency: process.env.STRIPE_CURRENCY || 'usd',
  }
}

export interface CreateCheckoutInput {
  paymentRequestId: string
  amount: number
  currency?: string
  description?: string
  successUrl: string
  cancelUrl: string
  customerEmail?: string
  metadata?: Record<string, string>
  hotelId?: string
}

export interface CheckoutResult {
  sessionId: string
  sessionUrl: string
}

export const StripeService = {
  /** Inyecta el resolver de config por hotel (lo llama composition-root con acceso al ORM). */
  setConfigResolver(fn: ConfigResolver): void {
    resolver = fn
  },

  /** Resuelve la config de Stripe: configuration del hotel > env global. */
  async getConfig(hotelId?: string): Promise<StripeConfig> {
    if (hotelId && resolver) {
      try {
        const cfg = await resolver(hotelId)
        if (cfg?.secretKey) return cfg
      } catch {
        // si el resolver falla, caer al env
      }
    }
    return envConfig()
  },

  async isConfigured(hotelId?: string): Promise<boolean> {
    const cfg = await this.getConfig(hotelId)
    return !!cfg.secretKey
  },

  async getClient(hotelId?: string): Promise<Stripe | null> {
    const cfg = await this.getConfig(hotelId)
    if (!cfg.secretKey) return null
    const cacheKey = hotelId || '__global__'
    const cached = clients.get(cacheKey)
    if (cached) return cached
    const c = new Stripe(cfg.secretKey, {
      apiVersion: '2025-08-27.basil' as any,
      appInfo: { name: 'SolmiOS', version: '1.0.0' },
    })
    clients.set(cacheKey, c)
    return c
  },

  async createCheckoutSession(input: CreateCheckoutInput): Promise<CheckoutResult> {
    const stripe = await this.getClient(input.hotelId)
    if (!stripe) throw new Error('Stripe no configurado')
    const cfg = await this.getConfig(input.hotelId)
    const session = await stripe.checkout.sessions.create({
      mode: 'payment',
      payment_method_types: ['card'],
      line_items: [{
        price_data: {
          currency: input.currency || cfg.currency || 'usd',
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
    return { sessionId: session.id, sessionUrl: session.url || '' }
  },

  /**
   * Verifica la firma del webhook con el secreto DE ESE HOTEL.
   *
   * Antes usaba el webhookSecret global del ENV, con este razonamiento: "hace falta el secret
   * ANTES de parsear el evento, que es donde viene el hotelId". El razonamiento era correcto,
   * la conclusión no: la solución es poner el hotel en la RUTA
   * (/api/stripe/webhook/:hotelId), no renunciar al aislamiento entre hoteles.
   */
  async verifyWebhook(hotelId: string, rawBody: string | Buffer, signature: string): Promise<Stripe.Event> {
    const cfg = await this.getConfig(hotelId)
    if (!cfg.secretKey) throw new Error('El hotel no tiene Stripe configurado')
    if (!cfg.webhookSecret) throw new Error('El hotel no tiene webhookSecret configurado')
    const stripe = await this.getClient(hotelId)
    if (!stripe) throw new Error('El hotel no tiene Stripe configurado')
    return stripe.webhooks.constructEvent(rawBody, signature, cfg.webhookSecret)
  },

  /** Tira el cliente cacheado de un hotel (tras cambiar sus llaves, sino sigue usando la vieja). */
  invalidate(hotelId: string): void {
    clients.delete(hotelId)
  },

  async getSession(sessionId: string, hotelId?: string): Promise<Stripe.Checkout.Session | null> {
    const stripe = await this.getClient(hotelId)
    if (!stripe) return null
    return stripe.checkout.sessions.retrieve(sessionId)
  },
}
