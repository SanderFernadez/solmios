// bookingengine/usecases/stripe.ts — Stripe Checkout Session integration

import type { RepositoryAdapter, Logger } from 'arckode-framework'
import { ValidationError } from 'arckode-framework'
import type { PublicBookingDTO } from '../types'

interface StripeConfig {
  secretKey: string
  webhookSecret: string
}

interface StripeSession {
  id: string
  url: string
  payment_status: string
}

export class StripeUseCase {
  private stripe: any = null
  private config: StripeConfig | null = null

  constructor(
    private readonly bookingRepo: RepositoryAdapter<PublicBookingDTO>,
    private readonly logger: Logger,
  ) {}

  async initialize(secretKey: string, webhookSecret: string): Promise<void> {
    if (!secretKey) {
      this.logger.warn('Stripe secret key not configured')
      return
    }
    
    try {
      // Dynamic import to avoid hard dependency
      const Stripe = (await import('stripe')).default
      this.stripe = new Stripe(secretKey, { apiVersion: '2026-05-27.dahlia' })
      this.config = { secretKey, webhookSecret }
      this.logger.info('Stripe initialized')
    } catch (err) {
      this.logger.error('Failed to initialize Stripe', { error: err })
    }
  }

  async createCheckoutSession(booking: PublicBookingDTO, successUrl: string, cancelUrl: string): Promise<StripeSession> {
    if (!this.stripe) {
      throw new ValidationError('Stripe not configured')
    }

    const session = await this.stripe.checkout.sessions.create({
      payment_method_types: ['card'],
      line_items: [{
        price_data: {
          currency: booking.currency.toLowerCase(),
          product_data: {
            name: `Reserva - ${booking.roomType}`,
            description: `Check-in: ${booking.checkIn} | Check-out: ${booking.checkOut}`,
          },
          unit_amount: Math.round(booking.totalAmount * 100),
        },
        quantity: 1,
      }],
      mode: 'payment',
      success_url: successUrl,
      cancel_url: cancelUrl,
      metadata: {
        bookingId: booking.id,
        hotelId: booking.hotelId,
      },
    })

    return {
      id: session.id,
      url: session.url || '',
      payment_status: session.payment_status,
    }
  }

  async handleWebhook(payload: Buffer, signature: string): Promise<{ type: string; bookingId?: string }> {
    if (!this.stripe || !this.config) {
      throw new ValidationError('Stripe not configured')
    }

    let event
    try {
      event = this.stripe.webhooks.constructEvent(payload, signature, this.config.webhookSecret)
    } catch (err) {
      this.logger.error('Webhook signature verification failed', { error: err })
      throw new ValidationError('Invalid webhook signature')
    }

    if (event.type === 'checkout.session.completed') {
      const session = event.data.object
      const bookingId = session.metadata?.bookingId
      
      if (bookingId) {
        await this.bookingRepo.update(bookingId, {
          status: 'confirmed',
          paymentStatus: 'paid',
          paymentRef: session.id,
        } as any)
        
        this.logger.info('Booking confirmed via Stripe', { bookingId, sessionId: session.id })
        return { type: 'booking_confirmed', bookingId }
      }
    }

    return { type: event.type }
  }

  isConfigured(): boolean {
    return this.stripe !== null
  }
}
