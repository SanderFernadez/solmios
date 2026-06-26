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
} from './validators/schema'

export class BookingengineController {
  constructor(
    private readonly service: BookingengineService,
    private readonly logger: Logger,
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
    const { successUrl, cancelUrl } = req.body as { successUrl: string; cancelUrl: string }
    const session = await this.service.createCheckoutSession(id, successUrl, cancelUrl)
    return { status: 200, body: session }
  }

  async handleStripeWebhook(req: HttpRequest) {
    this.logger.info('POST /api/public/webhook/stripe')
    const signature = (req as any).headers?.['stripe-signature'] || ''
    const payload = (req as any).rawBody || Buffer.from(JSON.stringify(req.body))
    const result = await this.service.handleStripeWebhook(payload, signature)
    return { status: 200, body: result }
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
}
