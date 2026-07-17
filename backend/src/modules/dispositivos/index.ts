import { createModule, OrmRepository } from 'arckode-framework'
import { registerDispositivosModels } from './model'
import { DispositivosService } from './service'
import { DispositivosController } from './controller'
import type { DispositivosDTO } from './types'
import { createPermissionGuard } from '../../infrastructure/auth/create-permission-guard'
import { createModuleGuard } from '../../infrastructure/auth/require-module'

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
      const userRepo = new OrmRepository<any>(orm, 'Users')
      const service = new DispositivosService(repo, log, cache, userRepo, auth)
      const controller = new DispositivosController(service, log)

      const roleRepo = new OrmRepository<any>(orm, 'Roles')
      const permGuard = createPermissionGuard(auth, roleRepo)
      const moduleGuard = createModuleGuard(orm)
      const guard = (m: string, a: string) => [...permGuard(m, a), moduleGuard('settings.devices')]

      router.get('/api/dispositivos', guard('settings', 'view'), (req) => controller.index(req))
      router.get('/api/dispositivos/:id', guard('settings', 'view'), (req) => controller.show(req))
      router.post('/api/dispositivos', guard('settings', 'create'), (req) => controller.store(req))
      // SC-03: el PUT (actualizar) exigía `settings:create` en vez de `settings:edit`.
      router.put('/api/dispositivos/:id', guard('settings', 'edit'), (req) => controller.update(req))
      router.delete('/api/dispositivos/:id', guard('settings', 'delete'), (req) => controller.destroy(req))

      log.info('Modulo dispositivos v2 listo')
      return service
    },
  })
}
