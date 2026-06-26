// payments/usecases/stripe.ts — Stripe integration for payments

import type { Logger } from 'arckode-framework'
import { ValidationError } from 'arckode-framework'

interface StripeConfig {
  secretKey: string
  webhookSecret: string
}

export class StripeUseCase {
  private stripe: any = null
  private config: StripeConfig | null = null

  constructor(private readonly logger: Logger) {}

  async initialize(secretKey: string, webhookSecret: string): Promise<void> {
    if (!secretKey) {
      this.logger.warn('Stripe secret key not configured')
      return
    }
    try {
      const Stripe = (await import('stripe')).default
      this.stripe = new Stripe(secretKey, { apiVersion: '2026-05-27.dahlia' })
      this.config = { secretKey, webhookSecret }
      this.logger.info('Stripe initialized for payments')
    } catch (err) {
      this.logger.error('Failed to initialize Stripe', { error: err })
    }
  }

  async createCheckoutSession(params: {
    amount: number
    currency: string
    description: string
    metadata: Record<string, string>
    successUrl: string
    cancelUrl: string
  }): Promise<{ id: string; url: string }> {
    if (!this.stripe) throw new ValidationError('Stripe not configured')

    const session = await this.stripe.checkout.sessions.create({
      payment_method_types: ['card'],
      line_items: [{
        price_data: {
          currency: params.currency.toLowerCase(),
          product_data: { name: params.description },
          unit_amount: Math.round(params.amount * 100),
        },
        quantity: 1,
      }],
      mode: 'payment',
      success_url: params.successUrl,
      cancel_url: params.cancelUrl,
      metadata: params.metadata,
    })

    return { id: session.id, url: session.url || '' }
  }

  async createPaymentIntent(params: {
    amount: number
    currency: string
    metadata: Record<string, string>
  }): Promise<{ id: string; clientSecret: string }> {
    if (!this.stripe) throw new ValidationError('Stripe not configured')

    const intent = await this.stripe.paymentIntents.create({
      amount: Math.round(params.amount * 100),
      currency: params.currency.toLowerCase(),
      metadata: params.metadata,
      automatic_payment_methods: { enabled: true },
    })

    return { id: intent.id, clientSecret: intent.client_secret || '' }
  }

  async refund(params: { paymentId: string; amount?: number }): Promise<{ id: string; status: string }> {
    if (!this.stripe) throw new ValidationError('Stripe not configured')

    const refund = await this.stripe.refunds.create({
      payment_intent: params.paymentId,
      ...(params.amount ? { amount: Math.round(params.amount * 100) } : {}),
    })

    return { id: refund.id, status: refund.status }
  }

  async createPaymentLink(params: {
    amount: number
    currency: string
    description: string
  }): Promise<{ id: string; url: string }> {
    if (!this.stripe) throw new ValidationError('Stripe not configured')

    const link = await this.stripe.paymentLinks.create({
      line_items: [{
        price_data: {
          currency: params.currency.toLowerCase(),
          product_data: { name: params.description },
          unit_amount: Math.round(params.amount * 100),
        },
        quantity: 1,
      }],
    })

    return { id: link.id, url: link.url }
  }

  async handleWebhook(payload: Buffer, signature: string): Promise<{ type: string; data: any }> {
    if (!this.stripe || !this.config) throw new ValidationError('Stripe not configured')

    let event
    try {
      event = this.stripe.webhooks.constructEvent(payload, signature, this.config.webhookSecret)
    } catch (err) {
      this.logger.error('Webhook signature verification failed', { error: err })
      throw new ValidationError('Invalid webhook signature')
    }

    return { type: event.type, data: event.data.object }
  }

  isConfigured(): boolean {
    return this.stripe !== null
  }
}
