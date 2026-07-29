// server-tracking/index.ts — PUERTA PÚBLICA del módulo (F3, spec server-tracking).
// ⚠ REGLA: Append-only. No sacar ni modificar exports existentes.
//
// Wiring: registra el modelo `TrackingEvent`, construye repos + service + controller, y
// expone 2 rutas admin (auth + permiso `settings:edit`):
//   POST /api/server-tracking/test     → dispara evento test (devuelve status Meta+GA4)
//   GET  /api/server-tracking/events   → historial de fires (auditoría)
//
// Las CREDS (meta_pixel_id, ga4_measurement_id, etc.) NO se configuran acá: viajan como
// keys libres en el módulo `configuration` (ConfigurationModule), y el frontend las
// persiste con ConfigService.set (mismo patrón que reputation.vue). Esto evita duplicar
// el guardado de configuration y respeta el contrato del endpoint /api/configuracion
// (settings:edit).
//
// El TRIGGER real (post-confirm del webhook Stripe) NO vive acá: el connector
// `bookingengine-tracking` subscribe a `bookingengine.onBookingPaid` y dispara
// `service.fireAll(reservationId, hotelId)` — mismo patrón que `reservas-wallet`.
// Así bookingengine no importa server-tracking (regla "NO importar de otro módulo
// directamente → connector en src/connectors/").
import { createModule, OrmRepository } from 'arckode-framework'
import { registerServerTrackingModels } from './model'
import { ServerTrackingService } from './service'
import { ServerTrackingController } from './controller'
import type { TrackingEventDTO } from './types'
import { createPermissionGuard } from '../../infrastructure/auth/create-permission-guard'
import { requireUserType } from '../../infrastructure/auth/require-user-type'

export { ServerTrackingService, ServerTrackingController }
export { registerServerTrackingModels } from './model'
export type {
  TrackingEventDTO, CreateTrackingEventDTO, FireResult, TestFireResult,
  TrackingEventType, TrackingTarget, TrackingStatus,
  ReservationTrackingData, TrackingConfig, TrackingFetcher, CurrentUser,
} from './types'
export type { ServerTrackingSockets } from './sockets'
export { ServerTrackingValidator, TestFireSchema, EventsQuerySchema } from './validators/schema'
export { hashSha256, normalizeEmail, normalizePhone, hashEmail, hashPhone } from './usecases/enhanced-conversions'

export function ServerTrackingModule() {
  return createModule({
    name: 'server-tracking',
    version: '1.0.0',
    description: 'Server-side tracking: Meta CAPI + GA4 Measurement Protocol + Enhanced Conversions (F3)',

    contract: {
      name: 'server-tracking',
      version: '1.0.0',
      description: 'Server-side tracking events (Meta CAPI + GA4 MP) with Enhanced Conversions',
      actions: ['fireAll', 'fireTest', 'listEvents', 'trackInternal'],
      events: [],
      tables: ['tracking_events'],
      dependencies: [],
      rules: [
        'Trigger: bookingengine.onBookingPaid via connector bookingengine-tracking (no HTTP)',
        'Multi-tenant por hotelId (configuration lleva las creds por hotel)',
        'Skip silencioso si faltan creds (status=skipped en tracking_events)',
        'Enhanced Conversions: PII hasheada SHA256 solo si marketingAccepted=true',
        'NUNCA lanza — toda excepción se persiste como status=failed',
      ],
    },

    create({ logger, orm, cache, router, auth }) {
      if (!auth) throw new Error('server-tracking: auth dependency required')
      registerServerTrackingModels(orm)

      const trackingRepo = new OrmRepository<TrackingEventDTO>(orm, 'TrackingEvent')
      const reservationsRepo = new OrmRepository<any>(orm, 'Reservations')
      const guestsRepo = new OrmRepository<any>(orm, 'Guests')
      const configRepo = new OrmRepository<any>(orm, 'Configuration')

      const log = logger.child('server-tracking')
      const service = new ServerTrackingService(trackingRepo, log, cache, {
        reservationsRepo,
        guestsRepo,
        configRepo,
      })
      const controller = new ServerTrackingController(service, log)

      // Guard admin: settings:edit es el permiso que ya tiene hotel_admin para tocar
      // configuration (reputation.vue usa el mismo). + userType merchant asegura que
      // no accede un super_admin del platform (que no tiene hotelId para testear).
      const roleRepo = new OrmRepository<any>(orm, 'Roles')
      const permGuard = createPermissionGuard(auth, roleRepo)
      const adminGuard = () => [...permGuard('settings', 'edit'), requireUserType('merchant')]

      router.post('/api/server-tracking/test', adminGuard(), (req: any) => controller.testFire(req))
      router.get('/api/server-tracking/events', adminGuard(), (req: any) => controller.events(req))

      log.info('Módulo server-tracking v1 listo (Meta CAPI + GA4 MP + Enhanced Conversions)')
      return service
    },
  })
}
