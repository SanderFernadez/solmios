import { createModule, OrmRepository } from 'arckode-framework'
import { registerReservasModels } from './model'
import { ReservasService } from './service'
import { ReservasController } from './controller'
import type { ReservasDTO } from './types'

export { ReservasService }
export type { ReservasDTO, CreateReservasDTO, UpdateReservasDTO, ReservasQuery, ReservasPaginated } from './types'
export type { ReservasSockets } from './sockets'
export { ReservasValidator, CreateReservasSchema, UpdateReservasSchema } from './validators/schema'

export function ReservasModule() {
  return createModule({
    name: 'reservas',
    version: '2.0.0',
    description: 'Módulo de reservas — bookings with availability check',
    contract: {
      name: 'reservas',
      version: '2.0.0',
      description: 'Reservations with ownership, availability, and validation',
      actions: ['list', 'getById', 'create', 'update', 'delete'],
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
      const service = new ReservasService(repo, log, cache, userRepo, auth, guestRepo, roomRepo, hotelRepo, blockRepo)
      const controller = new ReservasController(service, log, companionsRepo, addonsRepo, repo, userRepo, auth)

      router.get('/api/reservas', [auth.authenticate('hotel_admin', 'receptionist', 'super_admin')], (req) => controller.index(req))
      router.get('/api/reservas/:id', [auth.authenticate('hotel_admin', 'receptionist', 'super_admin')], (req) => controller.show(req))
      router.post('/api/reservas', [auth.authenticate('hotel_admin', 'receptionist', 'super_admin')], (req) => controller.store(req))
      router.put('/api/reservas/:id', [auth.authenticate('hotel_admin', 'super_admin')], (req) => controller.update(req))
      router.delete('/api/reservas/:id', [auth.authenticate('hotel_admin', 'super_admin')], (req) => controller.destroy(req))

      // ── Companions (F2) — /api/reservations/* (detalle enriquecido, distinto del CRUD /api/reservas) ──
      router.get('/api/reservations/:id/companions', [auth.authenticate('hotel_admin', 'receptionist', 'super_admin')], (req) => controller.listCompanions(req))
      router.post('/api/reservations/:id/companions', [auth.authenticate('hotel_admin', 'receptionist', 'super_admin')], (req) => controller.createCompanion(req))
      router.put('/api/companions/:id', [auth.authenticate('hotel_admin', 'super_admin')], (req) => controller.updateCompanion(req))
      router.delete('/api/companions/:id', [auth.authenticate('hotel_admin', 'super_admin')], (req) => controller.deleteCompanion(req))

      // ── Addons (F2) ──
      router.get('/api/reservations/:id/addons', [auth.authenticate('hotel_admin', 'receptionist', 'super_admin')], (req) => controller.listAddons(req))
      router.post('/api/reservations/:id/addons', [auth.authenticate('hotel_admin', 'receptionist', 'super_admin')], (req) => controller.createAddon(req))
      router.delete('/api/addons/:id', [auth.authenticate('hotel_admin', 'super_admin')], (req) => controller.deleteAddon(req))

      log.info('Módulo reservas v2 listo')
      return service
    },
  })
}
