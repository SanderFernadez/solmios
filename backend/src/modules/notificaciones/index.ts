import { createModule, OrmRepository } from 'arckode-framework'
import { registerNotificacionesModels } from './model'
import { NotificacionesService } from './service'
import { NotificacionesController } from './controller'
import type { NotificacionesDTO } from './types'
import { createPermissionGuard } from '../../infrastructure/auth/create-permission-guard'

export { NotificacionesService }
export type { NotificacionesDTO, CreateNotificacionesDTO, UpdateNotificacionesDTO, NotificacionesQuery, NotificacionesPaginated } from './types'
export type { NotificacionesSockets } from './sockets'
export { NotificacionesValidator, CreateNotificacionesSchema, UpdateNotificacionesSchema } from './validators/schema'

export function NotificacionesModule() {
  return createModule({
    name: 'notificaciones',
    version: '2.0.0',
    description: 'Módulo de notificaciones',
    contract: {
      name: 'notificaciones',
      version: '2.0.0',
      description: 'Notifications with ownership and pagination',
      actions: ['list', 'getById', 'create', 'update', 'delete'],
      events: ['onNotificacionesCreated', 'onNotificacionesUpdated', 'onNotificacionesDeleted'],
      tables: ['notifications'],
      dependencies: [],
      rules: ['Ownership check required', 'hotelId not updatable'],
    },
    create({ logger, orm, cache, router, auth }) {
      if (!auth) throw new Error('notificaciones: auth dependency required')
      registerNotificacionesModels(orm)
      const repo = new OrmRepository<NotificacionesDTO>(orm, 'Notifications')
      const userRepo = new OrmRepository<any>(orm, 'Users')
      const log = logger.child('notificaciones')
      const service = new NotificacionesService(repo, userRepo, log, cache, auth)
      const controller = new NotificacionesController(service, log)

      const roleRepo = new OrmRepository<any>(orm, 'Roles')
      const guard = createPermissionGuard(auth, roleRepo)

      router.get('/api/notificaciones', guard('dashboard', 'view'), (req) => controller.index(req))
      router.get('/api/notificaciones/:id', guard('dashboard', 'view'), (req) => controller.show(req))
      router.post('/api/notificaciones', guard('dashboard', 'create'), (req) => controller.store(req))
      router.put('/api/notificaciones/:id', guard('dashboard', 'create'), (req) => controller.update(req))
      router.delete('/api/notificaciones/:id', guard('dashboard', 'delete'), (req) => controller.destroy(req))

      log.info('Módulo notificaciones v2 listo')
      return service
    },
  })
}
