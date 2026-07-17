import { createModule, OrmRepository } from 'arckode-framework'
import { registerOpinionesModels } from './model'
import { OpinionesService } from './service'
import { OpinionesController } from './controller'
import type { OpinionesDTO } from './types'
import { createPermissionGuard } from '../../infrastructure/auth/create-permission-guard'
import { createModuleGuard } from '../../infrastructure/auth/require-module'

export { OpinionesService }
export type { OpinionesDTO, CreateOpinionesDTO, UpdateOpinionesDTO, OpinionesQuery, OpinionesPaginated } from './types'
export type { OpinionesSockets } from './sockets'
export { OpinionesValidator, CreateOpinionesSchema, UpdateOpinionesSchema } from './validators/schema'

export function OpinionesModule() {
  return createModule({
    name: 'opiniones',
    version: '2.0.0',
    description: 'Módulo de opiniones — reseñas de huéspedes',
    contract: {
      name: 'opiniones',
      version: '2.0.0',
      description: 'Reviews with ownership and pagination',
      actions: ['list', 'getById', 'create', 'update', 'delete'],
      events: ['onOpinionesCreated', 'onOpinionesUpdated', 'onOpinionesDeleted'],
      tables: ['reviews'],
      dependencies: [],
      rules: ['Ownership check required', 'hotelId not updatable'],
    },
    create({ logger, orm, cache, router, auth }) {
      if (!auth) throw new Error('opiniones: auth dependency required')
      registerOpinionesModels(orm)
      const repo = new OrmRepository<OpinionesDTO>(orm, 'Reviews')
      const log = logger.child('opiniones')
      const userRepo = new OrmRepository<any>(orm, 'Users')
      const service = new OpinionesService(repo, log, cache, userRepo, auth)
      const controller = new OpinionesController(service, log)

      const roleRepo = new OrmRepository<any>(orm, 'Roles')
      const permGuard = createPermissionGuard(auth, roleRepo)
      const moduleGuard = createModuleGuard(orm)
      const guard = (m: string, a: string) => [...permGuard(m, a), moduleGuard('sales.reviews')]

      router.get('/api/opiniones', guard('reports', 'view'), (req) => controller.index(req))
      router.get('/api/opiniones/:id', guard('reports', 'view'), (req) => controller.show(req))
      router.post('/api/opiniones', guard('reports', 'create'), (req) => controller.store(req))
      router.put('/api/opiniones/:id', guard('reports', 'edit'), (req) => controller.update(req))
      router.delete('/api/opiniones/:id', guard('reports', 'delete'), (req) => controller.destroy(req))

      log.info('Módulo opiniones v2 listo')
      return service
    },
  })
}
