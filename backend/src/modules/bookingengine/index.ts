// bookingengine/index.ts — PUERTA PÚBLICA
// Módulo BookingEngine: config admin + endpoints públicos (sin auth)
// Endpoints: admin /booking-engine/* + público /api/public/*, /api/widgets/*

import { createModule, OrmRepository } from 'arckode-framework'
import { registerBookingengineModels } from './model'
import { BookingengineService } from './service'
import { BookingengineController } from './controller'
import type { BookingConfigDTO, PublicBookingDTO, ConversionEventDTO } from './types'
import { createPermissionGuard } from '../../infrastructure/auth/create-permission-guard'
import { PaymentGatewayRegistry } from '../../services/payment-gateway/registry'
import { PaymentEventStore } from '../../services/payment-gateway/payment-events'
import { rateLimit, getClientIp } from '../../shared/middlewares/rate-limit'

export { BookingengineService }
export type { BookingConfigDTO, UpdateBookingConfigDTO, AvailabilityQuery, AvailabilityResult, PublicBookingDTO, CreatePublicBookingDTO, ConversionEventDTO, CreateConversionEventDTO, BookingAnalytics } from './types'
export type { BookingengineSockets } from './sockets'
export { BookingengineValidator, UpdateBookingConfigSchema, CheckAvailabilitySchema, CreatePublicBookingSchema, TrackEventSchema } from './validators/schema'

export function BookingengineModule(opts?: { pushAvailability?: (hotelId: string, roomId: string) => void }) {
  return createModule({
    name: 'bookingengine',
    version: '1.0.0',
    description: 'Booking engine: widget config, public availability, reservations, analytics',

    contract: {
      name: 'bookingengine',
      version: '1.0.0',
      description: 'Booking engine: widget config, public availability, reservations, analytics',
      actions: ['getConfig', 'updateConfig', 'checkAvailability', 'createBooking', 'getBooking', 'trackEvent', 'getAnalytics', 'getPublicBookingBySlug', 'createPublicBookingDirect'],
      events: ['onBookingCreated', 'onBookingCancelled', 'onConversionEvent'],
      tables: ['booking_config', 'availability_cache', 'conversion_events'],
      dependencies: ['canales', 'hoteles', 'habitaciones'],
      rules: ['No importar de otros módulos directamente'],
    },

    create({ logger, orm, cache, router, auth }: { logger: any; orm: any; cache: any; router: any; auth?: any }) {
      registerBookingengineModels(orm)

      const configRepo = new OrmRepository<BookingConfigDTO>(orm, 'BookingConfig')
      const availabilityRepo = new OrmRepository<any>(orm, 'AvailabilityCache')
      const roomsRepo = new OrmRepository<any>(orm, 'Rooms')
      const reservationsRepo = new OrmRepository<any>(orm, 'Reservations')
      const hotelsRepo = new OrmRepository<any>(orm, 'Hotels')
      const bookingRepo = new OrmRepository<PublicBookingDTO>(orm, 'BookingEngine')
      const eventsRepo = new OrmRepository<ConversionEventDTO>(orm, 'ConversionEvents')

      const log = logger.child('bookingengine')
      // La pasarela se resuelve POR HOTEL: el huésped que reserva en el widget del Hotel A le
      // paga a la cuenta del Hotel A, no a la del .env del servidor.
      const gatewayRepo = new OrmRepository<any>(orm, 'PaymentGateways')
      const registry = new PaymentGatewayRegistry(gatewayRepo as any, log)
      // Barrera anti-doble-cobro para el webhook público.
      const eventStore = new PaymentEventStore(new OrmRepository<any>(orm, 'PaymentEvents') as any, log)
      const service = new BookingengineService(configRepo, availabilityRepo, roomsRepo, reservationsRepo, hotelsRepo, bookingRepo, eventsRepo, log, cache, registry, eventStore)
      const controller = new BookingengineController(service, log, orm, auth, opts?.pushAvailability, hotelsRepo)

      // Admin routes (protegidas con auth)
      if (auth) {
        const roleRepo = new OrmRepository<any>(orm, 'Roles')
        const guard = createPermissionGuard(auth, roleRepo)

        router.get('/booking-engine/config', guard('settings', 'view'), (req: any) => controller.getConfig(req))
        router.put('/booking-engine/config', guard('settings', 'edit'), (req: any) => controller.updateConfig(req))
        router.get('/booking-engine/analytics', guard('reports', 'view'), (req: any) => controller.getAnalytics(req))
        // GET /api/booking-engine lo sirve el módulo `reservas`, que se registra antes y gana por orden de ruta.
      }

      // Público (sin auth) — TODOS con rate-limit por IP (F0 0.5). Límites y claves por
      // especificación (openspec/changes/solmi-direct-booking/specs/public-hotel-info/spec.md):
      // queries read-only 60/60s, escritura de bookings/checkout 20/60s, eventos 120/60s.
      // El webhook de Stripe NO se rate-limite acá: la firma criptográfica es validación
      // suficiente, y un límite por IP podría bloquear a Stripe mismo tras un replay storm.
      router.post('/api/public/availability', async (req: any) => {
        const { allowed, retryAfter } = rateLimit(`public-availability:${getClientIp(req)}`, { maxAttempts: 60, windowMs: 60_000 })
        if (!allowed) return { status: 429, body: { error: 'Too many requests', retryAfter } }
        return controller.checkAvailability(req)
      })
      router.get('/api/public/hotel/:slug', async (req: any) => {
        const { allowed, retryAfter } = rateLimit(`public-hotel-info:${getClientIp(req)}`, { maxAttempts: 60, windowMs: 60_000 })
        if (!allowed) return { status: 429, body: { error: 'Too many requests', retryAfter } }
        return controller.getHotelPublicInfo(req)
      })
      router.get('/api/public/booking/:slug', async (req: any) => {
        const { allowed, retryAfter } = rateLimit(`public-booking-info:${getClientIp(req)}`, { maxAttempts: 60, windowMs: 60_000 })
        if (!allowed) return { status: 429, body: { error: 'Too many requests', retryAfter } }
        return controller.getPublicBookingBySlug(req)
      })
      router.post('/api/public/booking', async (req: any) => {
        const { allowed, retryAfter } = rateLimit(`public-booking-create:${getClientIp(req)}`, { maxAttempts: 20, windowMs: 60_000 })
        if (!allowed) return { status: 429, body: { error: 'Too many requests', retryAfter } }
        return controller.createPublicBookingDirect(req)
      })
      router.post('/api/public/bookings', async (req: any) => {
        const { allowed, retryAfter } = rateLimit(`public-bookings-create:${getClientIp(req)}`, { maxAttempts: 20, windowMs: 60_000 })
        if (!allowed) return { status: 429, body: { error: 'Too many requests', retryAfter } }
        return controller.createBooking(req)
      })
      router.get('/api/public/bookings/:id', async (req: any) => {
        const { allowed, retryAfter } = rateLimit(`public-bookings-get:${getClientIp(req)}`, { maxAttempts: 60, windowMs: 60_000 })
        if (!allowed) return { status: 429, body: { error: 'Too many requests', retryAfter } }
        return controller.getBooking(req)
      })
      router.post('/api/public/bookings/:id/checkout', async (req: any) => {
        const { allowed, retryAfter } = rateLimit(`public-checkout:${getClientIp(req)}`, { maxAttempts: 20, windowMs: 60_000 })
        if (!allowed) return { status: 429, body: { error: 'Too many requests', retryAfter } }
        return controller.createCheckoutSession(req)
      })
      router.post('/api/public/webhook/stripe/:hotelId', (req: any) => controller.handleStripeWebhook(req))
      router.post('/api/public/events', async (req: any) => {
        const { allowed, retryAfter } = rateLimit(`public-events:${getClientIp(req)}`, { maxAttempts: 120, windowMs: 60_000 })
        if (!allowed) return { status: 429, body: { error: 'Too many requests', retryAfter } }
        return controller.trackEvent(req)
      })

      // Widget endpoints — mismo rate-limit que la ruta pública equivalente (es un alias).
      router.get('/api/widgets/availability/:hotelId', async (req: any) => {
        const { allowed, retryAfter } = rateLimit(`public-widget-availability:${getClientIp(req)}`, { maxAttempts: 60, windowMs: 60_000 })
        if (!allowed) return { status: 429, body: { error: 'Too many requests', retryAfter } }
        return controller.checkAvailability(req)
      })

      // Ya no se inicializa Stripe con process.env: la pasarela sale de payment_gateways del hotel.

      log.info('BookingEngine module ready')
      return service
    },
  })
}
