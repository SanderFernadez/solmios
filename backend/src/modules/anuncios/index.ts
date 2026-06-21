// anuncios/index.ts — PUERTA PÚBLICA
// Solo esto es visible para otros módulos y conectores.
// ⚠ REGLA: Append-only. No sacar ni modificar exports existentes.

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
    version: '1.0.0',
    description: 'Módulo de anuncios',

    contract: {
      name: 'anuncios',
      version: '1.0.0',
      description: 'Módulo de anuncios',
      actions: ["list","getById","create","update","delete"],
      events: ["onAnunciosCreated","onAnunciosUpdated","onAnunciosDeleted"],
      tables: ['anuncios'],
      dependencies: [],
      rules: ['No importar de otros módulos'],
    },

    create({ logger, orm, cache, router, auth }) {
      // Registrar modelo(s) — delegado a model.ts
      registerAnunciosModels(orm)

      const repo = new OrmRepository<AnunciosDTO>(orm, 'Announcements')
      const log = logger.child('anuncios')
      const service = new AnunciosService(repo, log, cache)
      const controller = new AnunciosController(service, log)

      // Rutas públicas por defecto — agregar [auth.authenticate()] para proteger
      router.get('/api/anuncios', [auth.authenticate('hotel_admin', 'receptionist', 'super_admin')], (req) => controller.index(req))
      router.get('/api/anuncios/:id', [auth.authenticate('hotel_admin', 'receptionist', 'super_admin')], (req) => controller.show(req))
      router.post('/api/anuncios', [auth.authenticate('hotel_admin', 'super_admin')], (req) => controller.store(req))
      router.put('/api/anuncios/:id', [auth.authenticate('hotel_admin', 'super_admin')], (req) => controller.update(req))
      router.delete('/api/anuncios/:id', [auth.authenticate('hotel_admin', 'super_admin')], (req) => controller.destroy(req))

      log.info('Módulo anuncios listo')
      return service
    },
  })
}
