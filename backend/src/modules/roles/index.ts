// roles/index.ts — PUERTA PÚBLICA
// Solo esto es visible para otros módulos y conectores.
// ⚠ REGLA: Append-only. No sacar ni modificar exports existentes.

import { createModule, OrmRepository } from 'arckode-framework'
import { registerRolesModels } from './model'
import { RolesService } from './service'
import { RolesController } from './controller'
import type { RolesDTO } from './types'

export { RolesService }
export type { RolesDTO, CreateRolesDTO, UpdateRolesDTO, RolesQuery, RolesPaginated } from './types'
export type { RolesSockets } from './sockets'
export { RolesValidator, CreateRolesSchema, UpdateRolesSchema } from './validators/schema'

export function RolesModule() {
  return createModule({
    name: 'roles',
    version: '1.0.0',
    description: 'Módulo de roles',

    contract: {
      name: 'roles',
      version: '1.0.0',
      description: 'Módulo de roles',
      actions: ["list","getById","create","update","delete"],
      events: ["onRolesCreated","onRolesUpdated","onRolesDeleted"],
      tables: ['roles'],
      dependencies: [],
      rules: ['No importar de otros módulos'],
    },

    create({ logger, orm, cache, router, auth }) {
      // Registrar modelo(s) — delegado a model.ts
      registerRolesModels(orm)

      const repo = new OrmRepository<RolesDTO>(orm, 'Roles')
      const log = logger.child('roles')
      const service = new RolesService(repo, log, cache)
      const controller = new RolesController(service, log)

      // Rutas públicas por defecto — agregar [auth.authenticate()] para proteger
      router.get('/api/roles', [auth.authenticate('hotel_admin', 'receptionist', 'super_admin')], (req) => controller.index(req))
      router.get('/api/roles/:id', [auth.authenticate('hotel_admin', 'receptionist', 'super_admin')], (req) => controller.show(req))
      router.post('/api/roles', [auth.authenticate('hotel_admin', 'super_admin')], (req) => controller.store(req))
      router.put('/api/roles/:id', [auth.authenticate('hotel_admin', 'super_admin')], (req) => controller.update(req))
      router.delete('/api/roles/:id', [auth.authenticate('hotel_admin', 'super_admin')], (req) => controller.destroy(req))

      log.info('Módulo roles listo')
      return service
    },
  })
}
