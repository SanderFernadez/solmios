import { createModule, OrmRepository } from 'arckode-framework'
import { registerApikeysModels } from './model'
import { ApikeysService } from './service'
import { ApikeysController } from './controller'
import type { ApikeysDTO } from './types'

export { ApikeysService }
export type { ApikeysDTO, CreateApikeysDTO, UpdateApikeysDTO, ApikeysQuery, ApikeysPaginated } from './types'
export type { ApikeysSockets } from './sockets'
export { ApikeysValidator, CreateApikeysSchema, UpdateApikeysSchema } from './validators/schema'

export function ApikeysModule() {
  return createModule({
    name: 'apikeys',
    version: '2.0.0',
    description: 'Módulo de API keys',
    contract: {
      name: 'apikeys',
      version: '2.0.0',
      description: 'API Keys with ownership and pagination',
      actions: ['list', 'getById', 'create', 'update', 'delete'],
      events: ['onApikeysCreated', 'onApikeysUpdated', 'onApikeysDeleted'],
      tables: ['api_keys'],
      dependencies: [],
      rules: ['Ownership check required', 'hotelId not updatable'],
    },
    create({ logger, orm, cache, router, auth }) {
      if (!auth) throw new Error('apikeys: auth dependency required')
      registerApikeysModels(orm)
      const repo = new OrmRepository<ApikeysDTO>(orm, 'Apikeys')
      const log = logger.child('apikeys')
      const service = new ApikeysService(repo, log, cache, auth)
      const controller = new ApikeysController(service, log)

      router.get('/api/apikeys', [auth.authenticate('hotel_admin', 'super_admin')], (req) => controller.index(req))
      router.get('/api/apikeys/:id', [auth.authenticate('hotel_admin', 'super_admin')], (req) => controller.show(req))
      router.post('/api/apikeys', [auth.authenticate('hotel_admin', 'super_admin')], (req) => controller.store(req))
      router.put('/api/apikeys/:id', [auth.authenticate('hotel_admin', 'super_admin')], (req) => controller.update(req))
      router.delete('/api/apikeys/:id', [auth.authenticate('hotel_admin', 'super_admin')], (req) => controller.destroy(req))

      log.info('Módulo apikeys v2 listo')
      return service
    },
  })
}
