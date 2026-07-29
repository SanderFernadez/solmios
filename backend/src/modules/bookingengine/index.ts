// bookingengine/index.ts — PUERTA PÚBLICA
// Módulo BookingEngine: config admin + endpoints públicos (sin auth)
// Endpoints: admin /booking-engine/* + público /api/public/*, /api/widgets/*

import { createModule, OrmRepository } from 'arckode-framework'
import { registerBookingengineModels } from './model'
import { BookingengineService } from './service'
import { BookingengineController } from './controller'
import type { BookingConfigDTO, PublicBookingDTO, ConversionEventDTO, UpsellDTO } from './types'
import { createPermissionGuard } from '../../infrastructure/auth/create-permission-guard'
import { requireUserType } from '../../infrastructure/auth/require-user-type'
import { PaymentGatewayRegistry } from '../../services/payment-gateway/registry'
import { PaymentEventStore } from '../../services/payment-gateway/payment-events'
import { rateLimit, getClientIp } from '../../shared/middlewares/rate-limit'
import { useUnifiedBookingFlow } from './usecases/unified-flow'

export { registerBookingengineModels, UpsellModel, BookingConfigModel, AvailabilityCacheModel, ConversionEventsModel, PublicBookingModel } from './model'
export { BookingengineService } from './service'
export type { BookingConfigDTO, UpdateBookingConfigDTO, AvailabilityQuery, AvailabilityResult, PublicBookingDTO, CreatePublicBookingDTO, ConversionEventDTO, CreateConversionEventDTO, BookingAnalytics, UpsellDTO, CreateUpsellDTO, UpdateUpsellDTO, UpsellKind } from './types'
export type { BookingengineSockets } from './sockets'
export { BookingengineValidator, UpdateBookingConfigSchema, CheckAvailabilitySchema, CreatePublicBookingSchema, TrackEventSchema, CreateUpsellSchema, UpdateUpsellSchema } from './validators/schema'

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

      // F2 2.3 — Upsells: deps para el controller (no el service, que se mantiene < 200 líneas).
      // El controller invoca los usecases directo; userRepo + auth se necesitan para ownership
      // (admin no puede tocar upsells de hotel ajeno).
      const upsellRepo = new OrmRepository<UpsellDTO>(orm, 'Upsells')
      const userRepoForUpsells = new OrmRepository<any>(orm, 'Users')
      // F2 2.4 / 2.5 — Deps nuevos: configuration (taxes + currency_rates) y promo_codes
      // (valida + incrementa uses en el flujo unificado). Sin estos, los endpoints públicos
      // /rates y /booking procesan todo vacío (degradación graceful, no rompe el flujo).
      const configurationRepo = new OrmRepository<any>(orm, 'Configuration')
      const promoCodesRepo = new OrmRepository<any>(orm, 'PromoCodes')

      const service = new BookingengineService(
        configRepo, availabilityRepo, roomsRepo, reservationsRepo, hotelsRepo,
        bookingRepo, eventsRepo, log, cache, registry, eventStore,
      )
      const controller = new BookingengineController(
        service, log, orm, auth, opts?.pushAvailability, hotelsRepo,
        upsellRepo, userRepoForUpsells, auth,
        configurationRepo, promoCodesRepo,
      )

      // Admin routes (protegidas con auth)
      if (auth) {
        const roleRepo = new OrmRepository<any>(orm, 'Roles')
        const guard = createPermissionGuard(auth, roleRepo)

        router.get('/booking-engine/config', guard('settings', 'view'), (req: any) => controller.getConfig(req))
        router.put('/booking-engine/config', guard('settings', 'edit'), (req: any) => controller.updateConfig(req))
        router.get('/booking-engine/analytics', guard('reports', 'view'), (req: any) => controller.getAnalytics(req))

        // F2 2.3 — Upsells admin. Permiso propio `upsells:*` (decisión: no reusar settings:* ni
        // booking-engine:edit porque no existe; cada recurso con su permiso, mismo criterio que
        // landing/media/promo). userType merchant asegura que no accede un staff userType=admin.
        const upsellGuard = (action: 'view' | 'create' | 'edit' | 'delete') => [
          ...guard('upsells', action),
          requireUserType('merchant'),
        ]
        router.get('/api/upsells', upsellGuard('view'), (req: any) => controller.listUpsells(req))
        router.post('/api/upsells', upsellGuard('create'), (req: any) => controller.createUpsell(req))
        router.put('/api/upsells/:id', upsellGuard('edit'), (req: any) => controller.updateUpsell(req))
        router.delete('/api/upsells/:id', upsellGuard('delete'), (req: any) => controller.destroyUpsell(req))
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
      // F2 2.4 — Tarifas públicas del hotel por slug: room types disponibles + fromPrice +
      // availableCount (D11 urgencia) + taxBreakdown. Rate-limit 60/60s (read-only, mismo
      // techo que /public/hotel/:slug). Sin auth.
      router.get('/api/public/hotels/:slug/rates', async (req: any) => {
        const { allowed, retryAfter } = rateLimit(`public-rates:${getClientIp(req)}`, { maxAttempts: 60, windowMs: 60_000 })
        if (!allowed) return { status: 429, body: { error: 'Too many requests', retryAfter } }
        return controller.getPublicRates(req)
      })
      // F2 2.6 — Lista upsells activos del hotel para el step de extras del widget. Rate-limit
      // 60/60s (read-only). Sin auth. Filtro opcional ?kind=per_room|per_person|per_stay.
      router.get('/api/public/hotels/:slug/upsells', async (req: any) => {
        const { allowed, retryAfter } = rateLimit(`public-upsells:${getClientIp(req)}`, { maxAttempts: 60, windowMs: 60_000 })
        if (!allowed) return { status: 429, body: { error: 'Too many requests', retryAfter } }
        return controller.getPublicUpsells(req)
      })
      // F3 3.15 — Comparativo de tarifas directo vs OTA (StayAPI). Devuelve el badge "ahorrás
      // $X reservando directo" SOLO si directo es más barato. Si no, `{showComparison:false}`
      // (no promociona OTAs más baratas). Rate-limit 30/60s (read-only pero llama API externa
      // paga — más estricto que /rates para no quemar quota de StayAPI). Sin auth.
      router.get('/api/public/hotels/:slug/ota-prices', async (req: any) => {
        const { allowed, retryAfter } = rateLimit(`public-ota-prices:${getClientIp(req)}`, { maxAttempts: 30, windowMs: 60_000 })
        if (!allowed) return { status: 429, body: { error: 'Too many requests', retryAfter } }
        return controller.getPublicOtaPrices(req)
      })
      // F1 1.11 — Sitemap dinámico. Público (sin auth), cache-control 1h. Rate-limit suave:
      // bots buenos respetan crawl-delay, pero un bot malicioso podría meter ruido. 60/min sobra.
      router.get('/sitemap.xml', async (req: any) => {
        const { allowed, retryAfter } = rateLimit(`sitemap:${getClientIp(req)}`, { maxAttempts: 60, windowMs: 60_000 })
        if (!allowed) return { status: 429, body: { error: 'Too many requests', retryAfter } }
        return controller.getSitemap(req)
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
        // F0 0.12 — Feature flag de rollback. Con flag en true (default dev), el flujo plural
        // queda 410 Gone para forzar al singular `/api/public/booking` (única fuente `Reservations`).
        if (useUnifiedBookingFlow()) {
          log.warn('POST /api/public/bookings deprecated by BOOKING_USE_UNIFIED_FLOW — use /api/public/booking')
          return { status: 410, body: { error: 'Deprecated. Use POST /api/public/booking' } }
        }
        const { allowed, retryAfter } = rateLimit(`public-bookings-create:${getClientIp(req)}`, { maxAttempts: 20, windowMs: 60_000 })
        if (!allowed) return { status: 429, body: { error: 'Too many requests', retryAfter } }
        return controller.createBooking(req)
      })
      router.get('/api/public/bookings/:id', async (req: any) => {
        if (useUnifiedBookingFlow()) {
          log.warn('GET /api/public/bookings/:id deprecated by BOOKING_USE_UNIFIED_FLOW — use /api/public/reservations/:id')
          return { status: 410, body: { error: 'Deprecated. Use GET /api/public/reservations/:id' } }
        }
        // ⚠️ F0 0.14 — IDOR todavía vivo: el flag está en false (prod rollback mode), el
        // flujo viejo sigue exponiendo cualquier reserva por UUID. Este log.warn URGENTE
        // es para que prod migre a `BOOKING_USE_UNIFIED_FLOW=true` (que responde 410 acá)
        // y se eliminen este branch + el endpoint en F4. Mientras tanto, NO sacar de acá.
        log.warn('URGENT DEPRECATION — GET /api/public/bookings/:id still exposes IDOR (BOOKING_USE_UNIFIED_FLOW=false). Set flag=true in prod and remove this branch (F4 deletes the endpoint).')
        const { allowed, retryAfter } = rateLimit(`public-bookings-get:${getClientIp(req)}`, { maxAttempts: 60, windowMs: 60_000 })
        if (!allowed) return { status: 429, body: { error: 'Too many requests', retryAfter } }
        return controller.getBooking(req)
      })
      // F0 0.14 — Endpoint público SEGURO. Token HMAC en ?token=X (anti-IDOR).
      router.get('/api/public/reservations/:id', async (req: any) => {
        const { allowed, retryAfter } = rateLimit(`public-reservation-get:${getClientIp(req)}`, { maxAttempts: 60, windowMs: 60_000 })
        if (!allowed) return { status: 429, body: { error: 'Too many requests', retryAfter } }
        return controller.getPublicReservation(req)
      })
      router.post('/api/public/bookings/:id/checkout', async (req: any) => {
        if (useUnifiedBookingFlow()) {
          log.warn('POST /api/public/bookings/:id/checkout deprecated by BOOKING_USE_UNIFIED_FLOW — use /api/public/reservations/:id/checkout')
          return { status: 410, body: { error: 'Deprecated. Use POST /api/public/reservations/:id/checkout' } }
        }
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
