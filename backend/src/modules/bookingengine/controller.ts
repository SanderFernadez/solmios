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

  async getPublicBookingBySlug(req: HttpRequest) {
    const slug = req.params.slug
    const q = (req.query || {}) as any
    const hotels = await this.orm!.findMany('Hotels', {}) as any[]
    const hotel = hotels.find((h: any) => h.name?.toLowerCase().replace(/\s+/g, '-') === slug || h.id === slug)
    if (!hotel) return { status: 404, body: { error: 'Hotel no encontrado' } }
    const rooms = await this.orm!.findMany('Rooms', { hotelId: hotel.id }) as any[]
    let available = rooms.filter((r: any) => r.status === 'disponible' || r.status === 'available')

    if (q.checkIn && q.checkOut) {
      const hotelRes = await this.orm!.findMany('Reservations', { hotelId: hotel.id }) as any[]
      const overlap = new Set(hotelRes
        .filter((r: any) => r.status !== 'cancelled' && r.status !== 'no_show' && r.checkIn < q.checkOut && r.checkOut > q.checkIn)
        .map((r: any) => r.roomId))
      available = available.filter((r: any) => !overlap.has(r.id))
    }

    const roomIds = new Set(rooms.map((r: any) => r.id))
    const amsRaw = ((await this.orm!.findMany('RoomAmenities', {})) as any[]).filter((a) => roomIds.has(a.roomId) && a.isActive !== false)
    const amsByRoom = new Map<string, string[]>()
    for (const a of amsRaw) {
      if (!amsByRoom.has(a.roomId)) amsByRoom.set(a.roomId, [])
      amsByRoom.get(a.roomId)!.push(a.amenityKey)
    }

    const byType = new Map<string, any[]>()
    for (const r of available) {
      const key = r.type || 'standard'
      if (!byType.has(key)) byType.set(key, [])
      byType.get(key)!.push({ id: r.id, number: r.number, name: r.name, basePrice: r.basePrice, capacity: r.capacity })
    }
    const roomTypes = Array.from(byType.entries()).map(([type, items]) => ({
      type, count: items.length, price: items[0].basePrice, rooms: items,
      amenities: amsByRoom.get(items[0].id) || [],
    }))
    return { status: 200, body: { hotel: { id: hotel.id, name: hotel.name, slug: hotel.name?.toLowerCase().replace(/\s+/g, '-') }, roomTypes } }
  }

  async createPublicBookingDirect(req: HttpRequest) {
    const { hotelId, roomId, guestName, guestEmail, guestPhone, checkIn, checkOut, adults, children: kids } = req.body as any
    if (!hotelId || !roomId || !guestName || !guestEmail || !checkIn || !checkOut) {
      return { status: 400, body: { error: 'Campos requeridos: hotelId, roomId, guestName, guestEmail, checkIn, checkOut' } }
    }
    if (checkIn >= checkOut) return { status: 400, body: { error: 'checkIn debe ser anterior a checkOut' } }
    const room = await this.orm!.findById('Rooms', roomId) as any
    if (!room) return { status: 404, body: { error: 'Habitación no encontrada' } }

    const overlapping = (await this.orm!.findMany('Reservations', { roomId })) as any[]
    const hasOverlap = overlapping.some((r: any) =>
      r.status !== 'cancelled' && r.status !== 'no_show' && r.checkIn < checkOut && r.checkOut > checkIn)
    if (hasOverlap) return { status: 409, body: { error: 'Habitación no disponible en esas fechas' } }

    const nights = Math.max(1, Math.round((new Date(checkOut).getTime() - new Date(checkIn).getTime()) / 86400000))
    const totalAmount = (room.basePrice || 0) * nights
    const guest = await this.orm!.create('Guests', {
      id: crypto.randomUUID(), hotelId, name: guestName, email: guestEmail, phone: guestPhone || '',
      documentType: 'passport', documentNumber: '', nationality: '', address: '',
    })
    const reservation = await this.orm!.create('Reservations', {
      id: crypto.randomUUID(), hotelId, roomId, guestId: guest.id,
      checkIn, checkOut, status: 'pending', source: 'direct',
      adults: adults || 1, children: kids || 0, totalAmount, deposit: 0,
      notes: 'Reserva desde widget público',
    })

    this.pushAvailability?.(hotelId, roomId)

    return { status: 201, body: { reservation, guest } }
  }

  async dashboard(req: HttpRequest) {
    this.logger.info('GET /api/booking-engine')
    const user = req.user as any
    const hotelId = user?.hotelId || (req.query as any)?.hotelId
    if (!hotelId) return { status: 400, body: { error: 'hotelId requerido' } }
    const result = await this.service.dashboard(this.orm, this.auth, hotelId, user)
    return { status: 200, body: result }
  }
}
