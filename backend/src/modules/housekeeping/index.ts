import { createModule, OrmRepository } from 'arckode-framework'
import { registerHousekeepingModels } from './model'
import { HousekeepingService } from './service'
import { HousekeepingController } from './controller'
import type { HousekeepingDTO } from './types'

export { HousekeepingService }
export type { HousekeepingDTO, CreateHousekeepingDTO, UpdateHousekeepingDTO, HousekeepingQuery, HousekeepingPaginated } from './types'
export type { HousekeepingSockets } from './sockets'
export { HousekeepingValidator, CreateHousekeepingSchema, UpdateHousekeepingSchema } from './validators/schema'

export function HousekeepingModule() {
  return createModule({
    name: 'housekeeping',
    version: '2.0.0',
    description: 'Módulo de housekeeping — limpieza y mantenimiento de habitaciones',
    contract: {
      name: 'housekeeping',
      version: '2.0.0',
      description: 'Housekeeping tasks with ownership and pagination',
      actions: ['list', 'getById', 'create', 'update', 'delete'],
      events: ['onHousekeepingCreated', 'onHousekeepingUpdated', 'onHousekeepingDeleted'],
      tables: ['housekeeping'],
      dependencies: [],
      rules: ['Ownership check required', 'hotelId not updatable'],
    },
    create({ logger, orm, cache, router, auth }) {
      if (!auth) throw new Error('housekeeping: auth dependency required')
      registerHousekeepingModels(orm)
      const repo = new OrmRepository<HousekeepingDTO>(orm, 'Housekeeping')
      const log = logger.child('housekeeping')
      const service = new HousekeepingService(repo, log, cache, auth)
      const controller = new HousekeepingController(service, log)

      router.get('/api/housekeeping', [auth.authenticate('hotel_admin', 'receptionist', 'super_admin')], (req) => controller.index(req))
      router.get('/api/housekeeping/:id', [auth.authenticate('hotel_admin', 'receptionist', 'super_admin')], (req) => controller.show(req))
      router.post('/api/housekeeping', [auth.authenticate('hotel_admin', 'receptionist', 'super_admin')], (req) => controller.store(req))
      router.put('/api/housekeeping/:id', [auth.authenticate('hotel_admin', 'super_admin')], (req) => controller.update(req))
      router.delete('/api/housekeeping/:id', [auth.authenticate('hotel_admin', 'super_admin')], (req) => controller.destroy(req))

      log.info('Módulo housekeeping v2 listo')
      return service
    },
  })
}
