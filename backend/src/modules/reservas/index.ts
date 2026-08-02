import { createModule, OrmRepository } from 'arckode-framework'
import { registerReservasModels } from './model'
import { ReservasService } from './service'
import { ReservasController } from './controller'
import { ReservasQueries } from './usecases/reservas-queries'
import { handleQScanProWebhook, type QScanProWebhookBody } from './usecases/qscanpro-webhook'
import type { ReservasDTO } from './types'
import { createPermissionGuard } from '../../infrastructure/auth/create-permission-guard'
import { createModuleGuard } from '../../infrastructure/auth/require-module'

export { ReservasService }
export type { ReservasDTO, CreateReservasDTO, UpdateReservasDTO, ReservasQuery, ReservasPaginated } from './types'
export type { ReservasSockets } from './sockets'
export { ReservasValidator, CreateReservasSchema, UpdateReservasSchema, PreCheckinSchema } from './validators/schema'

export function ReservasModule() {
  return createModule({
    name: 'reservas',
    version: '2.1.0',
    description: 'Módulo de reservas — bookings, checkin/checkout, pre-checkin, guarantee cards, detail, audit',
    contract: {
      name: 'reservas',
      version: '2.1.0',
      description: 'Reservations with ownership, availability, validation, checkin/checkout, pre-checkin, guarantee',
      actions: ['list', 'getById', 'create', 'update', 'delete', 'checkin', 'checkout', 'getExtendedDetail', 'getAuditTrail', 'getPreCheckinData', 'submitPreCheckin', 'getBookingEngineDashboard', 'sendLockCodeEmail'],
      events: ['onReservasCreated', 'onReservasUpdated', 'onReservasDeleted'],
      tables: ['reservations'],
      dependencies: [],
      rules: ['Ownership check required', 'hotelId not updatable', 'Availability check on create/update'],
    },
    create({ logger, orm, cache, router, auth }) {
      if (!auth) throw new Error('reservas: auth dependency required')
      registerReservasModels(orm)
      const repo = new OrmRepository<ReservasDTO>(orm, 'Reservations')
      const log = logger.child('reservas')
      const userRepo = new OrmRepository<any>(orm, 'Users')
      const guestRepo = new OrmRepository<any>(orm, 'Guests')
      const roomRepo = new OrmRepository<any>(orm, 'Rooms')
      const hotelRepo = new OrmRepository<any>(orm, 'Hotels')
      const blockRepo = new OrmRepository<any>(orm, 'RoomBlocks')
      const dateRestrictionRepo = new OrmRepository<any>(orm, 'DateRestrictions')
      const companionsRepo = new OrmRepository<any>(orm, 'Companions')
      const addonsRepo = new OrmRepository<any>(orm, 'ReservationAddons')
      const messageLogRepo = new OrmRepository<any>(orm, 'MessageLogs')
      const queries = new ReservasQueries(orm)
      const service = new ReservasService(repo, log, cache, userRepo, auth, guestRepo, roomRepo, hotelRepo, queries, blockRepo, dateRestrictionRepo)
      const controller = new ReservasController(service, log, companionsRepo, addonsRepo, repo, userRepo, auth, orm, null, messageLogRepo, roomRepo, hotelRepo)

      const roleRepo = new OrmRepository<any>(orm, 'Roles')
      const configRepo = new OrmRepository<any>(orm, 'Configuration')
      const permGuard = createPermissionGuard(auth, roleRepo)
      const moduleGuard = createModuleGuard(orm)
      const guard = (m: string, a: string) => [...permGuard(m, a), moduleGuard('reservations.list')]

      // ── CRUD ──
      router.get('/api/reservas', guard('reservations', 'view'), (req) => controller.index(req))
      router.get('/api/reservas/:id', guard('reservations', 'view'), (req) => controller.show(req))
      router.post('/api/reservas', guard('reservations', 'create'), (req) => controller.store(req))
      router.put('/api/reservas/:id', guard('reservations', 'edit'), (req) => controller.update(req))
      router.delete('/api/reservas/:id', guard('reservations', 'delete'), (req) => controller.destroy(req))

      // ── Companions ──
      router.get('/api/reservations/:id/companions', guard('reservations', 'view'), (req) => controller.listCompanions(req))
      router.post('/api/reservations/:id/companions', guard('reservations', 'edit'), (req) => controller.createCompanion(req))
      router.put('/api/companions/:id', guard('reservations', 'edit'), (req) => controller.updateCompanion(req))
      router.delete('/api/companions/:id', guard('reservations', 'delete'), (req) => controller.deleteCompanion(req))

      // ── Addons ──
      router.get('/api/reservations/:id/addons', guard('reservations', 'view'), (req) => controller.listAddons(req))
      router.post('/api/reservations/:id/addons', guard('reservations', 'edit'), (req) => controller.createAddon(req))
      router.delete('/api/addons/:id', guard('reservations', 'delete'), (req) => controller.deleteAddon(req))

      // ── Reschedule (mover/extender desde planning) ── quote antes que commit (orden de registro) ──
      router.post('/api/reservas/:id/reschedule/quote', guard('reservations', 'edit'), (req) => controller.rescheduleQuote(req))
      router.post('/api/reservas/:id/reschedule', guard('reservations', 'edit'), (req) => controller.reschedule(req))

      // ── Check-in / Check-out ──
      router.post('/api/reservas/:id/checkin', guard('reservations', 'checkin'), (req) => controller.checkin(req))
      router.post('/api/reservas/:id/checkout', guard('reservations', 'checkout'), (req) => controller.checkout(req))

      // ── Enviar código de cerradura por email (botón del planning) ──
      router.post('/api/reservas/:id/send-lock-code-email', guard('reservations', 'edit'), (req) => controller.sendLockCodeEmail(req))

      // ── Pre-checkin (público) ──
      router.get('/api/public/pre-checkin/:hash', (req) => controller.getPreCheckinData(req))
      router.post('/api/public/pre-checkin/:hash', (req) => controller.submitPreCheckin(req))

      // ── Webhook QScanPro (document scan) — público, autoridad = connection_code ──
      router.post('/api/webhooks/qscanpro', (req) =>
        handleQScanProWebhook((req.body ?? {}) as QScanProWebhookBody, { reservationRepo: repo, guestRepo, configRepo, logger: log })
          .then((data) => ({ status: 200, body: { success: true, data } })),
      )

      // ── Extended detail + Audit ──
      router.get('/api/reservations/:id', guard('reservations', 'view'), (req) => controller.getExtendedDetail(req))
      router.get('/api/reservations/:id/audit', guard('reservations', 'view'), (req) => controller.getAuditTrail(req))

      // ── Guarantee card ──
      router.post('/api/guarantee/pin', guard('reservations', 'edit'), (req) => controller.setGuaranteePin(req))
      router.get('/api/guarantee/has-pin', guard('reservations', 'view'), (req) => controller.getGuaranteeHasPin(req))
      router.post('/api/reservations/:id/guarantee-card/unlock', guard('reservations', 'edit'), (req) => controller.unlockGuaranteeCard(req))

      // ── Booking engine dashboard ──
      router.get('/api/booking-engine', guard('reservations', 'view'), (req) => controller.getBookingEngineDashboard(req))

      log.info('Módulo reservas v2.1 listo (23 endpoints)')
      return service
    },
  })
}
