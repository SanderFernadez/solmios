import { createModule, OrmRepository } from 'arckode-framework'
import { registerAnunciosModels } from './model'
import { AnunciosService } from './service'
import { AnunciosController } from './controller'
import type { AnunciosDTO } from './types'

export { AnunciosService }
export type { AnunciosDTO, CreateAnunciosDTO, UpdateAnunciosDTO, AnunciosQuery, AnunciosPaginated } from './types'
export type { AnunciosSockets } from './sockets'
export { AnunciosValidator, CreateAnunciosSchema, UpdateAnunciosSchema } from './validators/schema'

export function AnunciosModule() {
  return createModule({
    name: 'anuncios',
    version: '2.0.0',
    description: 'Modulo de anuncios — comunicados del hotel',
    contract: {
      name: 'anuncios',
      version: '2.0.0',
      description: 'Announcements with ownership and pagination',
      actions: ['list', 'getById', 'create', 'update', 'delete'],
      events: ['onAnunciosCreated', 'onAnunciosUpdated', 'onAnunciosDeleted'],
      tables: ['announcements'],
      dependencies: [],
      rules: ['Ownership check required', 'hotelId not updatable'],
    },
    create({ logger, orm, cache, router, auth }) {
      if (!auth) throw new Error('anuncios: auth dependency required')
      registerAnunciosModels(orm)
      const repo = new OrmRepository<AnunciosDTO>(orm, 'Announcements')
      const log = logger.child('anuncios')
      const userRepo = new OrmRepository<any>(orm, 'Users')
      const service = new AnunciosService(repo, log, cache, userRepo, auth)
      const controller = new AnunciosController(service, log)

      router.get('/api/anuncios', [auth.authenticate('hotel_admin', 'receptionist', 'super_admin')], (req) => controller.index(req))
      router.get('/api/anuncios/:id', [auth.authenticate('hotel_admin', 'receptionist', 'super_admin')], (req) => controller.show(req))
      router.post('/api/anuncios', [auth.authenticate('hotel_admin', 'super_admin')], (req) => controller.store(req))
      router.put('/api/anuncios/:id', [auth.authenticate('hotel_admin', 'super_admin')], (req) => controller.update(req))
      router.delete('/api/anuncios/:id', [auth.authenticate('hotel_admin', 'super_admin')], (req) => controller.destroy(req))

      log.info('Modulo anuncios v2 listo')
      return service
    },
  })
}
