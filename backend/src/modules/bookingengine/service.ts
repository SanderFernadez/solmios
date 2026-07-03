// bookingengine/service.ts — Facade pública del módulo
// Orquestador delgado que delega a usecases/

import type { RepositoryAdapter, Logger, CacheAdapter } from 'arckode-framework'
import type {
  BookingConfigDTO, UpdateBookingConfigDTO,
  AvailabilityQuery, AvailabilityResult,
  PublicBookingDTO, CreatePublicBookingDTO,
  ConversionEventDTO, CreateConversionEventDTO,
  BookingAnalytics,
} from './types'
import type { BookingengineSockets } from './sockets'
import { getDashboardData } from './usecases/dashboard-data'
import { ConfigUseCase } from './usecases/config'
import { AvailabilityUseCase } from './usecases/availability'
import { BookingUseCase } from './usecases/booking'
import { AnalyticsUseCase } from './usecases/analytics'
import { StripeUseCase } from './usecases/stripe'

export class BookingengineService {
  private sockets: BookingengineSockets = {}
  private config: ConfigUseCase
  private availability: AvailabilityUseCase
  private booking: BookingUseCase
  private analytics: AnalyticsUseCase
  private stripe: StripeUseCase

  constructor(
    configRepo: RepositoryAdapter<BookingConfigDTO>,
    availabilityRepo: RepositoryAdapter<any>,
    bookingRepo: RepositoryAdapter<PublicBookingDTO>,
    eventsRepo: RepositoryAdapter<ConversionEventDTO>,
    private readonly logger: Logger,
    cache: CacheAdapter,
  ) {
    this.config = new ConfigUseCase(configRepo, cache)
    this.availability = new AvailabilityUseCase(availabilityRepo, cache)
    this.booking = new BookingUseCase(bookingRepo, this.availability)
    this.analytics = new AnalyticsUseCase(eventsRepo)
    this.stripe = new StripeUseCase(bookingRepo, logger)
  }

  setSockets(s: Partial<BookingengineSockets>): void {
    const next = s as Record<string, any>
    const cur = this.sockets as Record<string, any>
    for (const key of Object.keys(next)) {
      const h = next[key]
      if (!h) continue
      const prev = cur[key]
      cur[key] = prev ? async (...a: any[]) => { await prev(...a); await h(...a) } : h
    }
  }

  async initStripe(secretKey: string, webhookSecret: string): Promise<void> {
    await this.stripe.initialize(secretKey, webhookSecret)
  }

  async getConfig(hotelId: string): Promise<BookingConfigDTO> {
    return this.config.get(hotelId)
  }

  async updateConfig(hotelId: string, dto: UpdateBookingConfigDTO): Promise<BookingConfigDTO> {
    return this.config.update(hotelId, dto)
  }

  async checkAvailability(query: AvailabilityQuery): Promise<AvailabilityResult> {
    return this.availability.check(query)
  }

  async createBooking(dto: CreatePublicBookingDTO): Promise<PublicBookingDTO> {
    const booking = await this.booking.create(dto)
    await this.trackEvent({ hotelId: dto.hotelId, sessionId: booking.id, event: 'booking_created', roomType: dto.roomType, amount: booking.totalAmount })
    await this.sockets.onBookingCreated?.(booking)
    return booking
  }

  async createCheckoutSession(bookingId: string, successUrl: string, cancelUrl: string) {
    const booking = await this.booking.getById(bookingId)
    return this.stripe.createCheckoutSession(booking, successUrl, cancelUrl)
  }

  async handleStripeWebhook(payload: Buffer, signature: string) {
    return this.stripe.handleWebhook(payload, signature)
  }

  async getBooking(id: string): Promise<PublicBookingDTO> {
    return this.booking.getById(id)
  }

  async trackEvent(dto: CreateConversionEventDTO): Promise<ConversionEventDTO> {
    return this.analytics.track(dto)
  }

  async getAnalytics(hotelId: string, from?: string, to?: string): Promise<BookingAnalytics> {
    return this.analytics.getAnalytics(hotelId, from, to)
  }

  async dashboard(orm: any, auth: any | null, hotelId: string, user?: any): Promise<any> {
    return getDashboardData(orm, auth, hotelId, user)
  }
}
