// bookingengine/service.ts — Facade pública del módulo
// Orquestador delgado que delega a usecases/

import type { RepositoryAdapter, Logger, CacheAdapter } from 'arckode-framework'
import { ValidationError } from 'arckode-framework'
import type {
  BookingConfigDTO, UpdateBookingConfigDTO,
  AvailabilityQuery, AvailabilityResult,
  PublicBookingDTO, CreatePublicBookingDTO,
  ConversionEventDTO, CreateConversionEventDTO,
  BookingAnalytics,
  UpsellDTO,
} from './types'
import type { BookingengineSockets } from './sockets'
import { ConfigUseCase } from './usecases/config'
import { AvailabilityUseCase } from './usecases/availability'
import { BookingUseCase } from './usecases/booking'
import { AnalyticsUseCase } from './usecases/analytics'
import { StripeUseCase } from './usecases/stripe'
import {
  syncUpsellFromPackage as syncUpsellFromPackageUsecase,
  removeSyncedUpsell as removeSyncedUpsellUsecase,
} from './usecases/upsells-sync'
import type { PaymentGatewayRegistry } from '../../services/payment-gateway/registry'
import type { PaymentEventStore } from '../../services/payment-gateway/payment-events'

export class BookingengineService {
  private sockets: BookingengineSockets = {}
  private config: ConfigUseCase
  private availability: AvailabilityUseCase
  private booking: BookingUseCase
  private analytics: AnalyticsUseCase
  private stripe: StripeUseCase
  // F0 0.15 — El método legacy `createCheckoutSession(bookingId, ...)` necesita acceso al
  // registry para hablar con el gateway directo (sin pasar por el usecase nuevo, que solo
  // sabe de Reservations). Se elimina en F4 junto con el flujo plural.
  private readonly registry: PaymentGatewayRegistry

  constructor(
    configRepo: RepositoryAdapter<BookingConfigDTO>,
    // La disponibilidad sale de las habitaciones y las reservas reales del
    // hotel, no de la tabla de stock (que nadie llena).
    roomsRepo: RepositoryAdapter<any> | undefined,
    reservationsRepo: RepositoryAdapter<any> | undefined,
    hotelsRepo: RepositoryAdapter<any> | undefined,
    private readonly bookingRepo: RepositoryAdapter<PublicBookingDTO>,
    eventsRepo: RepositoryAdapter<ConversionEventDTO>,
    private readonly logger: Logger,
    cache: CacheAdapter,
    registry?: PaymentGatewayRegistry,
    events?: PaymentEventStore,
    /**
     * F4 4.1 — Repo sobre `TrackingEvent` para el funnel de conversión. Opcional para no
     * romper tests viejos: si no se pasa, el funnel devuelve 0 en todos los steps.
     */
    trackingRepo?: RepositoryAdapter<any>,
    /** Repo de `Upsells` para el connector paquetes-bookingengine — ver usecases/upsells-sync.ts. */
    private readonly upsellRepoForSync?: RepositoryAdapter<UpsellDTO>,
  ) {
    if (!registry) throw new Error('bookingengine: PaymentGatewayRegistry es requerido (pasarela por hotel)')
    if (!reservationsRepo) throw new Error('bookingengine: reservationsRepo es requerido (F0 0.15 — Stripe opera sobre Reservations)')
    this.registry = registry
    this.config = new ConfigUseCase(configRepo, cache)
    this.availability = new AvailabilityUseCase(cache, roomsRepo, reservationsRepo, hotelsRepo)
    this.booking = new BookingUseCase(bookingRepo, this.availability)
    this.analytics = new AnalyticsUseCase(eventsRepo, trackingRepo)
    // F0 0.15 — Stripe opera sobre Reservations (tabla operacional). Antes usaba `bookingRepo`
    // (tabla huérfana `public_bookings`), que nunca recibía filas del widget — el cobro quedaba
    // colgado de una reserva inexistente. Spec booking-unification D2/D3.
    // Hardening go-live — Pasamos hotelsRepo para que StripeUseCase construya el successUrl
    // real con slug + reservationId + accessToken (antes pasaba placeholders literales a Stripe).
    this.stripe = new StripeUseCase(reservationsRepo, logger, registry, events, hotelsRepo ?? undefined)
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

  /** FIX 2026-07-31 — Ofertas → Upsells (ver usecases/upsells-sync.ts). Llamado por
   *  connectors/paquetes-bookingengine.ts. No-op si upsellRepoForSync no está cableado. */
  async syncUpsellFromPackage(pkg: { id: string; hotelId: string; name: string; description?: string | null; price: number; active?: number | boolean }): Promise<void> {
    if (!this.upsellRepoForSync) return
    await syncUpsellFromPackageUsecase({ upsells: this.upsellRepoForSync }, pkg)
  }

  async removeSyncedUpsell(packageId: string): Promise<void> {
    if (!this.upsellRepoForSync) return
    await removeSyncedUpsellUsecase({ upsells: this.upsellRepoForSync }, packageId)
  }

  // initStripe() eliminado: inicializaba UNA cuenta global (process.env) para todos los hoteles.
  // Ahora la pasarela se resuelve con el hotelId de la propia reserva.

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

  /**
   * F0 0.15 — Checkout sobre `Reservations`. Antes este método recibía un `bookingId` y leía
   * de `public_bookings`. Ahora recibe `reservationId`, y el monto lo pasa el caller explícito
   * (evita race condition: el precio del cuarto podría cambiar entre leer y cobrar).
   */
  async createReservationCheckout(
    reservationId: string,
    amount: number,
    successUrl: string,
    cancelUrl: string,
  ) {
    return this.stripe.createCheckoutSession(reservationId, amount, successUrl, cancelUrl)
  }

  /**
   * Cobro del widget (flujo plural viejo sobre `public_bookings`). Se mantiene para no romper
   * el endpoint `POST /api/public/bookings/:id/checkout` detrás del flag
   * `BOOKING_USE_UNIFIED_FLOW=false` (rollback path). Cuando el flag está true el controller
   * responde 410 antes de llegar acá. En F4 se elimina junto con el flujo plural.
   *
   * F0 0.15 — Antes delegaba en `StripeUseCase.createCheckoutSession(booking, ...)`. Ese
   * usecase ahora opera sobre `Reservations` y la firma cambió. Para no duplicar la lógica de
   * reescritura en un usecase paralelo (que se borraría en F4), hablamos con el gateway directo
   * desde acá. Solo para rollback; el flujo principal pasa por `createReservationCheckout`.
   */
  async createCheckoutSession(bookingId: string, successUrl: string, cancelUrl: string) {
    const booking = await this.booking.getById(bookingId)
    const gw = await this.registry.resolve(booking.hotelId)
    if (!gw) {
      throw new ValidationError('El hotel no tiene una pasarela de pago configurada')
    }
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
    throw new ValidationError(result.status === 'failed' ? result.reason : 'Pasarela no soportada')
  }

  /**
   * El cobro del widget es plata real que entra por Stripe. Sin emitir el evento, quedaba solo en la
   * fila de `bookings`: fuera de `payments`, de la conciliación bancaria y del balance.
   *
   * El hotel viene en la RUTA: su secreto de firma es lo que autentica el webhook.
   */
  async handleStripeWebhook(hotelId: string, payload: Buffer | string, signature: string) {
    const result = await this.stripe.handleWebhook(hotelId, payload, signature)
    if (!result) return null // firma inválida → el controller responde 400
    // F0 0.15 — El type del resultado cambió a 'reservation_confirmed' (era 'booking_confirmed').
    // El socket del widget espera la reserva pagada para refrescar la UI. Pasamos el id que sea
    // (reservationId en el flujo unificado) — el socket decide qué hacer con el payload.
    if (result.type === 'reservation_confirmed' && result.reservationId) {
      await this.sockets.onBookingPaid?.({ id: result.reservationId } as any)
    }
    return result
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
}
