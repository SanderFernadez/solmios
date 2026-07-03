// bookingengine/index.ts — PUERTA PÚBLICA
// Módulo BookingEngine: config admin + endpoints públicos (sin auth)
// Endpoints: admin /booking-engine/* + público /api/public/*, /api/widgets/*

import { createModule, OrmRepository } from 'arckode-framework'
import { registerBookingengineModels } from './model'
import { BookingengineService } from './service'
import { BookingengineController } from './controller'
import type { BookingConfigDTO, PublicBookingDTO, ConversionEventDTO } from './types'

export { BookingengineService }
export type { BookingConfigDTO, UpdateBookingConfigDTO, AvailabilityQuery, AvailabilityResult, PublicBookingDTO, CreatePublicBookingDTO, ConversionEventDTO, CreateConversionEventDTO, BookingAnalytics } from './types'
export type { BookingengineSockets } from './sockets'
export { BookingengineValidator, UpdateBookingConfigSchema, CheckAvailabilitySchema, CreatePublicBookingSchema, TrackEventSchema } from './validators/schema'

export function BookingengineModule() {
  return createModule({
    name: 'bookingengine',
    version: '1.0.0',
    description: 'Booking engine: widget config, public availability, reservations, analytics',

    contract: {
      name: 'bookingengine',
      version: '1.0.0',
      description: 'Booking engine: widget config, public availability, reservations, analytics',
      actions: ['getConfig', 'updateConfig', 'checkAvailability', 'createBooking', 'getBooking', 'trackEvent', 'getAnalytics'],
      events: ['onBookingCreated', 'onBookingCancelled', 'onConversionEvent'],
      tables: ['booking_config', 'availability_cache', 'conversion_events'],
      dependencies: ['canales', 'hoteles', 'habitaciones'],
      rules: ['No importar de otros módulos directamente'],
    },

    create({ logger, orm, cache, router, auth }: { logger: any; orm: any; cache: any; router: any; auth?: any }) {
      registerBookingengineModels(orm)

      const configRepo = new OrmRepository<BookingConfigDTO>(orm, 'BookingConfig')
      const availabilityRepo = new OrmRepository<any>(orm, 'AvailabilityCache')
      const bookingRepo = new OrmRepository<PublicBookingDTO>(orm, 'BookingEngine')
      const eventsRepo = new OrmRepository<ConversionEventDTO>(orm, 'ConversionEvents')

      const log = logger.child('bookingengine')
      const service = new BookingengineService(configRepo, availabilityRepo, bookingRepo, eventsRepo, log, cache, orm, auth)
      const controller = new BookingengineController(service, log, orm)

      // Admin routes (protegidas con auth)
      if (auth) {
        router.get('/booking-engine/config', [auth.authenticate('admin', 'superadmin')], (req: any) => controller.getConfig(req))
        router.put('/booking-engine/config', [auth.authenticate('admin', 'superadmin')], (req: any) => controller.updateConfig(req))
        router.get('/booking-engine/analytics', [auth.authenticate('admin', 'superadmin')], (req: any) => controller.getAnalytics(req))
        router.get('/api/booking-engine', [auth.authenticate('hotel_admin', 'super_admin')], (req: any) => controller.dashboard(req))
      }

      // Público (sin auth)
      router.post('/api/public/availability', (req: any) => controller.checkAvailability(req))
      router.get('/api/public/hotel/:slug', (req: any) => controller.getHotelPublicInfo(req))
      router.post('/api/public/bookings', (req: any) => controller.createBooking(req))
      router.get('/api/public/bookings/:id', (req: any) => controller.getBooking(req))
      router.post('/api/public/bookings/:id/checkout', (req: any) => controller.createCheckoutSession(req))
      router.post('/api/public/webhook/stripe', (req: any) => controller.handleStripeWebhook(req))
      router.post('/api/public/events', (req: any) => controller.trackEvent(req))

      // Widget endpoints
      router.get('/api/widgets/availability/:hotelId', (req: any) => controller.checkAvailability(req))

      // Initialize Stripe if configured
      const stripeKey = process.env.STRIPE_SECRET_KEY
      const stripeWebhook = process.env.STRIPE_WEBHOOK_SECRET
      if (stripeKey && stripeWebhook) {
        service.initStripe(stripeKey, stripeWebhook).catch(() => {})
      }

      log.info('BookingEngine module ready')
      return service
    },
  })
}
