import { createModule, OrmRepository } from 'arckode-framework'
import { registerNotificacionesModels } from './model'
import { NotificacionesService } from './service'
import { NotificacionesController } from './controller'
import type { NotificacionesDTO } from './types'

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
      const log = logger.child('notificaciones')
      const service = new NotificacionesService(repo, log, cache, auth)
      const controller = new NotificacionesController(service, log)

      router.get('/api/notificaciones', [auth.authenticate('hotel_admin', 'receptionist', 'super_admin')], (req) => controller.index(req))
      router.get('/api/notificaciones/:id', [auth.authenticate('hotel_admin', 'receptionist', 'super_admin')], (req) => controller.show(req))
      router.post('/api/notificaciones', [auth.authenticate('hotel_admin', 'super_admin')], (req) => controller.store(req))
      router.put('/api/notificaciones/:id', [auth.authenticate('hotel_admin', 'super_admin')], (req) => controller.update(req))
      router.delete('/api/notificaciones/:id', [auth.authenticate('hotel_admin', 'super_admin')], (req) => controller.destroy(req))

      log.info('Módulo notificaciones v2 listo')
      return service
    },
  })
}
