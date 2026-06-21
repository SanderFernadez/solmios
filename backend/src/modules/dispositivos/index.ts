import { createModule, OrmRepository } from 'arckode-framework'
import { registerDispositivosModels } from './model'
import { DispositivosService } from './service'
import { DispositivosController } from './controller'
import type { DispositivosDTO } from './types'

export { DispositivosService }
export type { DispositivosDTO, CreateDispositivosDTO, UpdateDispositivosDTO, DispositivosQuery, DispositivosPaginated } from './types'
export type { DispositivosSockets } from './sockets'
export { DispositivosValidator, CreateDispositivosSchema, UpdateDispositivosSchema } from './validators/schema'

export function DispositivosModule() {
  return createModule({
    name: 'dispositivos',
    version: '2.0.0',
    description: 'Modulo de dispositivos - sesiones de usuario',
    contract: {
      name: 'dispositivos',
      version: '2.0.0',
      description: 'Devices with ownership and pagination',
      actions: ['list', 'getById', 'create', 'update', 'delete'],
      events: ['onDispositivosCreated', 'onDispositivosUpdated', 'onDispositivosDeleted'],
      tables: ['devices'],
      dependencies: [],
      rules: ['Ownership check required', 'hotelId not updatable'],
    },
    create({ logger, orm, cache, router, auth }) {
      if (!auth) throw new Error('dispositivos: auth dependency required')
      registerDispositivosModels(orm)
      const repo = new OrmRepository<DispositivosDTO>(orm, 'Devices')
      const log = logger.child('dispositivos')
      const service = new DispositivosService(repo, log, cache, auth)
      const controller = new DispositivosController(service, log)

      router.get('/api/dispositivos', [auth.authenticate('hotel_admin', 'receptionist', 'super_admin')], (req) => controller.index(req))
      router.get('/api/dispositivos/:id', [auth.authenticate('hotel_admin', 'receptionist', 'super_admin')], (req) => controller.show(req))
      router.post('/api/dispositivos', [auth.authenticate('hotel_admin', 'super_admin')], (req) => controller.store(req))
      router.put('/api/dispositivos/:id', [auth.authenticate('hotel_admin', 'super_admin')], (req) => controller.update(req))
      router.delete('/api/dispositivos/:id', [auth.authenticate('hotel_admin', 'super_admin')], (req) => controller.destroy(req))

      log.info('Modulo dispositivos v2 listo')
      return service
    },
  })
}
