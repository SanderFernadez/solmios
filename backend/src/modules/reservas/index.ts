import { createModule, OrmRepository } from 'arckode-framework'
import { registerReservasModels } from './model'
import { ReservasService } from './service'
import { ReservasController } from './controller'
import type { ReservasDTO } from './types'

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
      actions: ['list', 'getById', 'create', 'update', 'delete', 'checkin', 'checkout', 'getExtendedDetail', 'getAuditTrail', 'getPreCheckinData', 'submitPreCheckin', 'getBookingEngineDashboard'],
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
      const companionsRepo = new OrmRepository<any>(orm, 'Companions')
      const addonsRepo = new OrmRepository<any>(orm, 'ReservationAddons')
      const messageLogRepo = new OrmRepository<any>(orm, 'MessageLogs')
      const service = new ReservasService(repo, log, cache, userRepo, auth, guestRepo, roomRepo, hotelRepo, blockRepo, orm)
      const controller = new ReservasController(service, log, companionsRepo, addonsRepo, repo, userRepo, auth, orm, null, messageLogRepo, roomRepo, hotelRepo)

      const hsa = [auth.authenticate('hotel_admin', 'super_admin')]
      const hra = [auth.authenticate('hotel_admin', 'receptionist', 'super_admin')]

      // ── CRUD ──
      router.get('/api/reservas', hra, (req) => controller.index(req))
      router.get('/api/reservas/:id', hra, (req) => controller.show(req))
      router.post('/api/reservas', hra, (req) => controller.store(req))
      router.put('/api/reservas/:id', hsa, (req) => controller.update(req))
      router.delete('/api/reservas/:id', hsa, (req) => controller.destroy(req))

      // ── Companions ──
      router.get('/api/reservations/:id/companions', hra, (req) => controller.listCompanions(req))
      router.post('/api/reservations/:id/companions', hra, (req) => controller.createCompanion(req))
      router.put('/api/companions/:id', hsa, (req) => controller.updateCompanion(req))
      router.delete('/api/companions/:id', hsa, (req) => controller.deleteCompanion(req))

      // ── Addons ──
      router.get('/api/reservations/:id/addons', hra, (req) => controller.listAddons(req))
      router.post('/api/reservations/:id/addons', hra, (req) => controller.createAddon(req))
      router.delete('/api/addons/:id', hsa, (req) => controller.deleteAddon(req))

      // ── Check-in / Check-out ──
      router.post('/api/reservas/:id/checkin', hra, (req) => controller.checkin(req))
      router.post('/api/reservas/:id/checkout', hra, (req) => controller.checkout(req))

      // ── Pre-checkin (público) ──
      router.get('/api/public/pre-checkin/:hash', (req) => controller.getPreCheckinData(req))
      router.post('/api/public/pre-checkin/:hash', (req) => controller.submitPreCheckin(req))

      // ── Extended detail + Audit ──
      router.get('/api/reservations/:id', hra, (req) => controller.getExtendedDetail(req))
      router.get('/api/reservations/:id/audit', hra, (req) => controller.getAuditTrail(req))

      // ── Guarantee card ──
      router.post('/api/guarantee/pin', hsa, (req) => controller.setGuaranteePin(req))
      router.get('/api/guarantee/has-pin', hra, (req) => controller.getGuaranteeHasPin(req))
      router.post('/api/reservations/:id/guarantee-card/unlock', hra, (req) => controller.unlockGuaranteeCard(req))

      // ── Booking engine dashboard ──
      router.get('/api/booking-engine', hsa, (req) => controller.getBookingEngineDashboard(req))

      log.info('Módulo reservas v2.1 listo (22 endpoints)')
      return service
    },
  })
}
