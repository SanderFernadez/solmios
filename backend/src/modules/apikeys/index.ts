// apikeys/index.ts — PUERTA PÚBLICA
// Solo esto es visible para otros módulos y conectores.
// ⚠ REGLA: Append-only. No sacar ni modificar exports existentes.

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
    version: '1.0.0',
    description: 'Módulo de apikeys',

    contract: {
      name: 'apikeys',
      version: '1.0.0',
      description: 'Módulo de apikeys',
      actions: ["list","getById","create","update","delete"],
      events: ["onApikeysCreated","onApikeysUpdated","onApikeysDeleted"],
      tables: ['apikeys'],
      dependencies: [],
      rules: ['No importar de otros módulos'],
    },

    create({ logger, orm, cache, router, auth }) {
      // Registrar modelo(s) — delegado a model.ts
      registerApikeysModels(orm)

      const repo = new OrmRepository<ApikeysDTO>(orm, 'Apikeys')
      const log = logger.child('apikeys')
      const service = new ApikeysService(repo, log, cache)
      const controller = new ApikeysController(service, log)

      // Rutas públicas por defecto — agregar [auth.authenticate()] para proteger
      router.get('/api/apikeys', [auth.authenticate('hotel_admin', 'receptionist', 'super_admin')], (req) => controller.index(req))
      router.get('/api/apikeys/:id', [auth.authenticate('hotel_admin', 'receptionist', 'super_admin')], (req) => controller.show(req))
      router.post('/api/apikeys', [auth.authenticate('hotel_admin', 'super_admin')], (req) => controller.store(req))
      router.put('/api/apikeys/:id', [auth.authenticate('hotel_admin', 'super_admin')], (req) => controller.update(req))
      router.delete('/api/apikeys/:id', [auth.authenticate('hotel_admin', 'super_admin')], (req) => controller.destroy(req))

      log.info('Módulo apikeys listo')
      return service
    },
  })
}
