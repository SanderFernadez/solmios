import { createModule, OrmRepository } from 'arckode-framework'
import { registerHabitacionesModels } from './model'
import { HabitacionesService } from './service'
import { HabitacionesController } from './controller'
import type { HabitacionesDTO } from './types'

export { HabitacionesService }
export type { HabitacionesDTO, CreateHabitacionesDTO, UpdateHabitacionesDTO, HabitacionesQuery, HabitacionesPaginated } from './types'
export type { HabitacionesSockets } from './sockets'
export { HabitacionesValidator, CreateHabitacionesSchema, UpdateHabitacionesSchema } from './validators/schema'

export function HabitacionesModule() {
  return createModule({
    name: 'habitaciones',
    version: '2.0.0',
    description: 'Modulo de habitaciones - rooms inventory with multi-tenancy',

    contract: {
      name: 'habitaciones',
      version: '2.0.0',
      description: 'Rooms with ownership, pagination, and validation',
      actions: ['list', 'getById', 'create', 'update', 'delete'],
      events: ['onHabitacionesCreated', 'onHabitacionesUpdated', 'onHabitacionesDeleted'],
      tables: ['rooms'],
      dependencies: [],
      rules: ['Ownership check required', 'hotelId not updatable'],
    },

    create({ logger, orm, cache, router, auth }) {
      if (!auth) throw new Error('habitaciones: auth dependency required')
      registerHabitacionesModels(orm)
      const repo = new OrmRepository<HabitacionesDTO>(orm, 'Rooms')
      const log = logger.child('habitaciones')
      const userRepo = new OrmRepository<any>(orm, 'Users')
      const service = new HabitacionesService(repo, log, cache, userRepo, auth)
      const controller = new HabitacionesController(service, log)

      router.get('/api/habitaciones', [auth.authenticate('hotel_admin', 'receptionist', 'super_admin')], (req) => controller.index(req))
      router.get('/api/habitaciones/:id', [auth.authenticate('hotel_admin', 'receptionist', 'super_admin')], (req) => controller.show(req))
      router.post('/api/habitaciones', [auth.authenticate('hotel_admin', 'super_admin')], (req) => controller.store(req))
      router.put('/api/habitaciones/:id', [auth.authenticate('hotel_admin', 'super_admin')], (req) => controller.update(req))
      router.delete('/api/habitaciones/:id', [auth.authenticate('hotel_admin', 'super_admin')], (req) => controller.destroy(req))

      log.info('Modulo habitaciones v2 listo')
      return service
    },
  })
}
