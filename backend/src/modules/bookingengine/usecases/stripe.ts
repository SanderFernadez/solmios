// bookingengine/usecases/stripe.ts — Cobro de la reserva pública contra la pasarela DEL HOTEL.
//
// ANTES: creaba su propio cliente de Stripe con process.env.STRIPE_SECRET_KEY. Un huésped que
// reservaba en el widget del Hotel A pagaba a la cuenta de Stripe del servidor, no a la del
// Hotel A. Este módulo era el más expuesto: es el que le cobra a huéspedes reales por internet.
//
// AHORA: la pasarela se resuelve con el hotelId de LA PROPIA RESERVA.

import type { RepositoryAdapter, Logger } from 'arckode-framework'
import { ValidationError } from 'arckode-framework'
import type { PublicBookingDTO } from '../types'
import type { PaymentGatewayRegistry } from '../../../services/payment-gateway/registry'
import type { PaymentEventStore } from '../../../services/payment-gateway/payment-events'

interface StripeSession {
  id: string
  url: string
  payment_status: string
}

export class StripeUseCase {
  constructor(
    private readonly bookingRepo: RepositoryAdapter<PublicBookingDTO>,
    private readonly logger: Logger,
    private readonly registry: PaymentGatewayRegistry,
    private readonly events?: PaymentEventStore,
  ) {}

  async isConfigured(hotelId: string): Promise<boolean> {
    return this.registry.isConfigured(hotelId)
  }

  async createCheckoutSession(
    booking: PublicBookingDTO,
    successUrl: string,
    cancelUrl: string,
  ): Promise<StripeSession> {
    // El hotel sale de la reserva: el dinero va a la cuenta del hotel que se está reservando.
    const gw = await this.registry.resolve(booking.hotelId)
    if (!gw) throw new ValidationError('El hotel no tiene una pasarela de pago configurada')

    const result = await gw.createCharge({
      hotelId: booking.hotelId,
      amountMinor: Math.round(booking.totalAmount * 100),
      currency: booking.currency,
      description: `Reserva - ${booking.roomType} | Check-in: ${booking.checkIn} | Check-out: ${booking.checkOut}`,
      reference: booking.id,
      successUrl,
      cancelUrl,
      metadata: { bookingId: booking.id, hotelId: booking.hotelId },
    })

    if (result.status === 'redirect') {
      return { id: result.providerRef, url: result.redirectUrl, payment_status: 'unpaid' }
    }
    if (result.status === 'succeeded') {
      return { id: result.providerRef, url: '', payment_status: 'paid' }
    }
    if (result.status === 'failed') throw new ValidationError(result.reason)
    throw new ValidationError('La pasarela pidió un paso adicional que todavía no está soportado')
  }

  /**
   * Confirma la reserva SOLO si la firma valida contra el secreto de ese hotel.
   * Devuelve null si el evento no es auténtico: sin esto, cualquiera podría confirmar una
   * reserva sin haber pagado, mandando un POST al webhook.
   */
  async handleWebhook(
    hotelId: string,
    payload: Buffer | string,
    signature: string,
  ): Promise<{ type: string; bookingId?: string } | null> {
    const gw = await this.registry.resolve(hotelId)
    if (!gw) throw new ValidationError('El hotel no tiene una pasarela de pago configurada')

    const outcome = await gw.confirm({
      hotelId,
      rawBody: payload,
      headers: { 'stripe-signature': signature },
    })
    if (!outcome) return null // firma inválida

    if (outcome.status === 'paid' && outcome.reference) {
      const bookingId = outcome.reference
      const booking = await this.bookingRepo.findById(bookingId)
      // Ownership: el webhook del Hotel A no puede confirmar una reserva del Hotel B.
      if (!booking || booking.hotelId !== hotelId) {
        this.logger.error(`Webhook del hotel ${hotelId} quiso confirmar la reserva ${bookingId}, que no es suya`)
        return null
      }
      if (!this.events) throw new Error('bookingengine: PaymentEventStore requerido para procesar webhooks')

      // Barrera atómica contra reintentos y webhooks concurrentes (este es el flujo público:
      // huéspedes reales pagando por internet). Reemplaza la verificación por paymentStatus, que
      // no frenaba dos webhooks a la vez.
      const result = await this.events.settleOnce(
        hotelId, 'stripe', outcome.eventId,
        { providerRef: outcome.providerRef, reference: bookingId, status: 'paid',
          amountMinor: outcome.amountMinor, currency: outcome.currency },
        async () => {
          await this.bookingRepo.update(bookingId, {
            status: 'confirmed', paymentStatus: 'paid', paymentRef: outcome.providerRef,
          } as any)
          this.logger.info(`Reserva ${bookingId} confirmada por pago (hotel ${hotelId})`)
        },
      )
      if (result.outcome === 'duplicate') return { type: 'already_processed', bookingId }
      return { type: 'booking_confirmed', bookingId }
    }

    return { type: outcome.status }
  }
}
