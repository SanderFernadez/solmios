// notificaciones/index.ts — PUERTA PÚBLICA
// Solo esto es visible para otros módulos y conectores.
// ⚠ REGLA: Append-only. No sacar ni modificar exports existentes.

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
    version: '1.0.0',
    description: 'Módulo de notificaciones',

    contract: {
      name: 'notificaciones',
      version: '1.0.0',
      description: 'Módulo de notificaciones',
      actions: ["list","getById","create","update","delete"],
      events: ["onNotificacionesCreated","onNotificacionesUpdated","onNotificacionesDeleted"],
      tables: ['notificaciones'],
      dependencies: [],
      rules: ['No importar de otros módulos'],
    },

    create({ logger, orm, cache, router, auth }) {
      // Registrar modelo(s) — delegado a model.ts
      registerNotificacionesModels(orm)

      const repo = new OrmRepository<NotificacionesDTO>(orm, 'Notifications')
      const log = logger.child('notificaciones')
      const service = new NotificacionesService(repo, log, cache)
      const controller = new NotificacionesController(service, log)

      // Rutas públicas por defecto — agregar [auth.authenticate()] para proteger
      router.get('/api/notificaciones', [auth.authenticate('hotel_admin', 'receptionist', 'super_admin')], (req) => controller.index(req))
      router.get('/api/notificaciones/:id', [auth.authenticate('hotel_admin', 'receptionist', 'super_admin')], (req) => controller.show(req))
      router.post('/api/notificaciones', [auth.authenticate('hotel_admin', 'super_admin')], (req) => controller.store(req))
      router.put('/api/notificaciones/:id', [auth.authenticate('hotel_admin', 'super_admin')], (req) => controller.update(req))
      router.delete('/api/notificaciones/:id', [auth.authenticate('hotel_admin', 'super_admin')], (req) => controller.destroy(req))

      log.info('Módulo notificaciones listo')
      return service
    },
  })
}
