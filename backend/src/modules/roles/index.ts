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
    version: '2.0.0',
    description: 'Módulo de roles — permisos por hotel',
    contract: {
      name: 'roles',
      version: '2.0.0',
      description: 'Roles with ownership, pagination, and system role protection',
      actions: ['list', 'getById', 'create', 'update', 'delete'],
      events: ['onRolesCreated', 'onRolesUpdated', 'onRolesDeleted'],
      tables: ['roles'],
      dependencies: [],
      rules: ['Ownership check required', 'System roles protected', 'hotelId not updatable'],
    },
    create({ logger, orm, cache, router, auth }) {
      if (!auth) throw new Error('roles: auth dependency required')
      registerRolesModels(orm)
      const repo = new OrmRepository<RolesDTO>(orm, 'Roles')
      const log = logger.child('roles')
      const service = new RolesService(repo, log, cache, auth)
      const controller = new RolesController(service, log)

      router.get('/api/roles', [auth.authenticate('hotel_admin', 'super_admin')], (req) => controller.index(req))
      router.get('/api/roles/:id', [auth.authenticate('hotel_admin', 'super_admin')], (req) => controller.show(req))
      router.post('/api/roles', [auth.authenticate('hotel_admin', 'super_admin')], (req) => controller.store(req))
      router.put('/api/roles/:id', [auth.authenticate('hotel_admin', 'super_admin')], (req) => controller.update(req))
      router.delete('/api/roles/:id', [auth.authenticate('hotel_admin', 'super_admin')], (req) => controller.destroy(req))

      log.info('Módulo roles v2 listo')
      return service
    },
  })
}
