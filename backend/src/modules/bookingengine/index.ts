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
      const bookingRepo = new OrmRepository<PublicBookingDTO>(orm, 'BookingEngine')
      const eventsRepo = new OrmRepository<ConversionEventDTO>(orm, 'ConversionEvents')

      const log = logger.child('bookingengine')
      // La pasarela se resuelve POR HOTEL: el huésped que reserva en el widget del Hotel A le
      // paga a la cuenta del Hotel A, no a la del .env del servidor.
      const gatewayRepo = new OrmRepository<any>(orm, 'PaymentGateways')
      const registry = new PaymentGatewayRegistry(gatewayRepo as any, log)
      // Barrera anti-doble-cobro para el webhook público.
      const eventStore = new PaymentEventStore(new OrmRepository<any>(orm, 'PaymentEvents') as any, log)
      const service = new BookingengineService(configRepo, availabilityRepo, bookingRepo, eventsRepo, log, cache, registry, eventStore)
      const controller = new BookingengineController(service, log, orm, auth, opts?.pushAvailability)

      // Admin routes (protegidas con auth)
      if (auth) {
        const roleRepo = new OrmRepository<any>(orm, 'Roles')
        const guard = createPermissionGuard(auth, roleRepo)

        router.get('/booking-engine/config', guard('settings', 'view'), (req: any) => controller.getConfig(req))
        router.put('/booking-engine/config', guard('settings', 'edit'), (req: any) => controller.updateConfig(req))
        router.get('/booking-engine/analytics', guard('reports', 'view'), (req: any) => controller.getAnalytics(req))
        // GET /api/booking-engine lo sirve el módulo `reservas`, que se registra antes y gana por orden de ruta.
      }

      // Público (sin auth)
      router.post('/api/public/availability', (req: any) => controller.checkAvailability(req))
      router.get('/api/public/hotel/:slug', (req: any) => controller.getHotelPublicInfo(req))
      router.get('/api/public/booking/:slug', (req: any) => controller.getPublicBookingBySlug(req))
      router.post('/api/public/booking', (req: any) => controller.createPublicBookingDirect(req))
      router.post('/api/public/bookings', (req: any) => controller.createBooking(req))
      router.get('/api/public/bookings/:id', (req: any) => controller.getBooking(req))
      router.post('/api/public/bookings/:id/checkout', (req: any) => controller.createCheckoutSession(req))
      router.post('/api/public/webhook/stripe/:hotelId', (req: any) => controller.handleStripeWebhook(req))
      router.post('/api/public/events', (req: any) => controller.trackEvent(req))

      // Widget endpoints
      router.get('/api/widgets/availability/:hotelId', (req: any) => controller.checkAvailability(req))

      // Ya no se inicializa Stripe con process.env: la pasarela sale de payment_gateways del hotel.

      log.info('BookingEngine module ready')
      return service
    },
  })
}
