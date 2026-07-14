// bookingengine/controller.ts — Adaptador HTTP del módulo
// Endpoints protegidos (admin) + endpoints públicos (sin auth) + Stripe webhook

import type { HttpRequest, Logger } from 'arckode-framework'
import { validateSchema } from 'arckode-framework'
import type { BookingengineService } from './service'
import type { AvailabilityQuery, CreatePublicBookingDTO, CreateConversionEventDTO, UpdateBookingConfigDTO } from './types'
import {
  UpdateBookingConfigSchema,
  CheckAvailabilitySchema,
  CreatePublicBookingSchema,
  TrackEventSchema,
  CreateCheckoutSessionSchema,
} from './validators/schema'
import { getPublicBookingBySlug, createPublicBookingDirect } from './usecases/public-booking'

export class BookingengineController {
  constructor(
    private readonly service: BookingengineService,
    private readonly logger: Logger,
    private readonly orm?: any,
    private readonly auth?: any,
    private readonly pushAvailability?: (hotelId: string, roomId: string) => void,
  ) {}

  // ─── Admin (protegido con auth) ──────────────────────

  async getConfig(req: HttpRequest) {
    this.logger.info('GET /booking-engine/config')
    const hotelId = (req as any).hotelId
    const config = await this.service.getConfig(hotelId)
    return { status: 200, body: config }
  }

  async updateConfig(req: HttpRequest) {
    this.logger.info('PUT /booking-engine/config')
    const hotelId = (req as any).hotelId
    const data = validateSchema(UpdateBookingConfigSchema, req.body) as UpdateBookingConfigDTO
    const config = await this.service.updateConfig(hotelId, data)
    return { status: 200, body: config }
  }

  async getAnalytics(req: HttpRequest) {
    this.logger.info('GET /booking-engine/analytics')
    const hotelId = (req as any).hotelId
    const { from, to } = req.query as { from?: string; to?: string }
    const analytics = await this.service.getAnalytics(hotelId, from, to)
    return { status: 200, body: analytics }
  }

  // ─── Público (sin auth) ──────────────────────────────

  async checkAvailability(req: HttpRequest) {
    this.logger.info('POST /api/public/availability')
    const data = validateSchema(CheckAvailabilitySchema, req.body) as unknown as AvailabilityQuery
    const result = await this.service.checkAvailability(data)
    return { status: 200, body: result }
  }

  async getHotelPublicInfo(req: HttpRequest) {
    this.logger.info('GET /api/public/hotel/:slug', { slug: req.params.slug })
    const config = await this.service.getConfig(req.params.slug)
    const hotelId = req.params.slug
    const availability = await this.service.checkAvailability({
      hotelId,
      checkIn: new Date().toISOString().split('T')[0],
      checkOut: new Date(Date.now() + 86400000).toISOString().split('T')[0],
    })
    return {
      status: 200,
      body: {
        id: hotelId,
        name: hotelId,
        slug: hotelId,
        currency: config.currency,
        checkIn: '14:00',
        checkOut: '11:00',
        roomTypes: availability.roomTypes.map(r => ({
          type: r.roomType,
          price: r.price,
          capacity: r.capacity,
        })),
      },
    }
  }

  async createBooking(req: HttpRequest) {
    this.logger.info('POST /api/public/bookings')
    const data = validateSchema(CreatePublicBookingSchema, req.body) as unknown as CreatePublicBookingDTO
    const booking = await this.service.createBooking(data)
    return { status: 201, body: booking }
  }

  async createCheckoutSession(req: HttpRequest) {
    this.logger.info('POST /api/public/bookings/:id/checkout')
    const { id } = req.params
    const data = validateSchema(CreateCheckoutSessionSchema, req.body) as any
    const session = await this.service.createCheckoutSession(id, data.successUrl, data.cancelUrl)
    return { status: 200, body: session }
  }

  /**
   * Webhook del motor de reservas. El hotel va en la RUTA: hay que saber de quién es el secreto
   * de firma ANTES de creerle al body. Sin verificación, cualquiera podría confirmar una reserva
   * sin pagarla mandando un POST acá.
   *
   * ⚠ Mientras el framework no exponga `rawBody` (kernel/http/server.ts hace JSON.parse y tira
   * los bytes), la firma no puede validarse y el endpoint rechaza todo. Es lo correcto: mejor no
   * confirmar una reserva paga que confirmar una falsa.
   */
  async handleStripeWebhook(req: HttpRequest) {
    const hotelId = String(req.params?.hotelId || '')
    if (!hotelId) return { status: 400, body: { error: 'Falta el hotel en la ruta del webhook' } }

    const signature = (req as any).headers?.['stripe-signature'] || ''
    const rawBody = (req as any).rawBody
    if (!rawBody) {
      this.logger.error('Webhook de reservas sin rawBody: la firma no puede verificarse (ver PG-0)')
      return { status: 503, body: { error: 'Verificación de firma no disponible' } }
    }

    try {
      const result = await this.service.handleStripeWebhook(hotelId, rawBody, signature)
      if (!result) return { status: 400, body: { error: 'Firma inválida' } }
      return { status: 200, body: result }
    } catch (e: any) {
      this.logger.error(`Webhook de reservas (hotel ${hotelId}): ${e?.message}`)
      return { status: 400, body: { error: e?.message || 'Webhook rechazado' } }
    }
  }

  async getBooking(req: HttpRequest) {
    this.logger.info('GET /api/public/bookings/:id', { id: req.params.id })
    const booking = await this.service.getBooking(req.params.id)
    return { status: 200, body: booking }
  }

  async trackEvent(req: HttpRequest) {
    this.logger.info('POST /api/public/events')
    const data = validateSchema(TrackEventSchema, req.body) as unknown as CreateConversionEventDTO
    const event = await this.service.trackEvent(data)
    return { status: 201, body: event }
  }

  async getPublicBookingBySlug(req: HttpRequest) {
    return getPublicBookingBySlug(this.orm, req.params.slug, req.query || {})
  }

  async createPublicBookingDirect(req: HttpRequest) {
    return createPublicBookingDirect(this.orm, req.body, this.pushAvailability, this.auth)
  }
}
