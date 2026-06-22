import { createModule, OrmRepository } from 'arckode-framework'
import { registerOpinionesModels } from './model'
import { OpinionesService } from './service'
import { OpinionesController } from './controller'
import type { OpinionesDTO } from './types'

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

      router.get('/api/opiniones', [auth.authenticate('hotel_admin', 'receptionist', 'super_admin')], (req) => controller.index(req))
      router.get('/api/opiniones/:id', [auth.authenticate('hotel_admin', 'receptionist', 'super_admin')], (req) => controller.show(req))
      router.post('/api/opiniones', [auth.authenticate('hotel_admin', 'super_admin')], (req) => controller.store(req))
      router.put('/api/opiniones/:id', [auth.authenticate('hotel_admin', 'super_admin')], (req) => controller.update(req))
      router.delete('/api/opiniones/:id', [auth.authenticate('hotel_admin', 'super_admin')], (req) => controller.destroy(req))

      log.info('Módulo opiniones v2 listo')
      return service
    },
  })
}
