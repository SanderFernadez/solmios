// activos/index.ts — PUERTA PÚBLICA (bienes/activos asignables a empleados).
import { createModule, OrmRepository } from 'arckode-framework'
import { registerActivosModels } from './model'
import { ActivosService } from './service'
import { ActivosController } from './controller'
import type { ActivosDTO } from './types'
import { createPermissionGuard } from '../../infrastructure/auth/create-permission-guard'

export { ActivosService }
export type { ActivosDTO, CreateActivosDTO, UpdateActivosDTO, ActivosQuery } from './types'
export type { ActivosSockets } from './sockets'
export { ActivosValidator, CreateActivosSchema, UpdateActivosSchema } from './validators/schema'

export function ActivosModule() {
  return createModule({
    name: 'activos',
    version: '1.0.0',
    description: 'Activos/equipo del hotel asignables a empleados (uniformes, llaves, equipos)',

    contract: {
      name: 'activos',
      version: '1.0.0',
      description: 'Inventario de bienes y su asignación a empleados',
      actions: ['list', 'getById', 'create', 'update', 'delete', 'assign', 'return'],
      events: ['onActivosCreated', 'onActivosUpdated', 'onActivosDeleted'],
      tables: ['assets'],
      dependencies: [],
      rules: ['No importar de otros módulos', 'Multi-tenant por hotelId'],
    },

    create({ logger, orm, cache, router, auth }) {
      if (!auth) throw new Error('activos: auth dependency required')
      registerActivosModels(orm)

      const repo = new OrmRepository<ActivosDTO>(orm, 'Asset')
      // Cross-table (no cross-module): validar que el empleado asignado sea del hotel.
      const profileRepo = new OrmRepository<{ id: string; hotelId: string }>(orm, 'EmployeeProfile')
      const log = logger.child('activos')
      const service = new ActivosService(repo, log, cache, profileRepo)
      const controller = new ActivosController(service, log)

      const roleRepo = new OrmRepository<any>(orm, 'Roles')
      const guard = createPermissionGuard(auth, roleRepo)

      router.get('/api/assets', guard('users', 'view'), (req) => controller.index(req))
      router.get('/api/assets/:id', guard('users', 'view'), (req) => controller.show(req))
      router.post('/api/assets', guard('users', 'create'), (req) => controller.store(req))
      router.put('/api/assets/:id', guard('users', 'edit'), (req) => controller.update(req))
      router.delete('/api/assets/:id', guard('users', 'delete'), (req) => controller.destroy(req))
      // Asignar/devolver un bien es operación de RRHH (users:edit).
      router.post('/api/assets/:id/assign', guard('users', 'edit'), (req) => controller.assign(req))
      router.post('/api/assets/:id/return', guard('users', 'edit'), (req) => controller.returnAsset(req))

      log.info('Módulo activos listo — 1 tabla, 7 endpoints')
      return service
    },
  })
}
