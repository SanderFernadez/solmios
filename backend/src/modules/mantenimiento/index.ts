import { createModule, OrmRepository } from 'arckode-framework'
import { registerMantenimientoModels } from './model'
import { MantenimientoService } from './service'
import { MantenimientoController } from './controller'
import type { MantenimientoDTO } from './types'

export { MantenimientoService }
export type { MantenimientoDTO, CreateMantenimientoDTO, UpdateMantenimientoDTO, MantenimientoQuery, MantenimientoPaginated } from './types'
export type { MantenimientoSockets } from './sockets'
export { MantenimientoValidator, CreateMantenimientoSchema, UpdateMantenimientoSchema } from './validators/schema'

export function MantenimientoModule() {
  return createModule({
    name: 'mantenimiento',
    version: '2.0.0',
    description: 'Modulo de mantenimiento — tickets de reparacion',
    contract: {
      name: 'mantenimiento',
      version: '2.0.0',
      description: 'Maintenance tickets with ownership and pagination',
      actions: ['list', 'getById', 'create', 'update', 'delete'],
      events: ['onMantenimientoCreated', 'onMantenimientoUpdated', 'onMantenimientoDeleted'],
      tables: ['maintenance'],
      dependencies: [],
      rules: ['Ownership check required', 'hotelId not updatable'],
    },
    create({ logger, orm, cache, router, auth }) {
      if (!auth) throw new Error('mantenimiento: auth dependency required')
      registerMantenimientoModels(orm)
      const repo = new OrmRepository<MantenimientoDTO>(orm, 'Maintenance')
      const log = logger.child('mantenimiento')
      const service = new MantenimientoService(repo, log, cache, auth)
      const controller = new MantenimientoController(service, log)

      router.get('/api/mantenimiento', [auth.authenticate('hotel_admin', 'receptionist', 'super_admin')], (req) => controller.index(req))
      router.get('/api/mantenimiento/:id', [auth.authenticate('hotel_admin', 'receptionist', 'super_admin')], (req) => controller.show(req))
      router.post('/api/mantenimiento', [auth.authenticate('hotel_admin', 'receptionist', 'super_admin')], (req) => controller.store(req))
      router.put('/api/mantenimiento/:id', [auth.authenticate('hotel_admin', 'super_admin')], (req) => controller.update(req))
      router.delete('/api/mantenimiento/:id', [auth.authenticate('hotel_admin', 'super_admin')], (req) => controller.destroy(req))

      log.info('Modulo mantenimiento v2 listo')
      return service
    },
  })
}
