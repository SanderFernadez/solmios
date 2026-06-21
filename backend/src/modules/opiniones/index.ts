// opiniones/index.ts — PUERTA PÚBLICA
// Solo esto es visible para otros módulos y conectores.
// ⚠ REGLA: Append-only. No sacar ni modificar exports existentes.

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
    version: '1.0.0',
    description: 'Módulo de opiniones',

    contract: {
      name: 'opiniones',
      version: '1.0.0',
      description: 'Módulo de opiniones',
      actions: ["list","getById","create","update","delete"],
      events: ["onOpinionesCreated","onOpinionesUpdated","onOpinionesDeleted"],
      tables: ['opiniones'],
      dependencies: [],
      rules: ['No importar de otros módulos'],
    },

    create({ logger, orm, cache, router, auth }) {
      // Registrar modelo(s) — delegado a model.ts
      registerOpinionesModels(orm)

      const repo = new OrmRepository<OpinionesDTO>(orm, 'Reviews')
      const log = logger.child('opiniones')
      const service = new OpinionesService(repo, log, cache)
      const controller = new OpinionesController(service, log)

      // Rutas públicas por defecto — agregar [auth.authenticate()] para proteger
      router.get('/api/opiniones', [auth.authenticate('hotel_admin', 'receptionist', 'super_admin')], (req) => controller.index(req))
      router.get('/api/opiniones/:id', [auth.authenticate('hotel_admin', 'receptionist', 'super_admin')], (req) => controller.show(req))
      router.post('/api/opiniones', [auth.authenticate('hotel_admin', 'super_admin')], (req) => controller.store(req))
      router.put('/api/opiniones/:id', [auth.authenticate('hotel_admin', 'super_admin')], (req) => controller.update(req))
      router.delete('/api/opiniones/:id', [auth.authenticate('hotel_admin', 'super_admin')], (req) => controller.destroy(req))

      log.info('Módulo opiniones listo')
      return service
    },
  })
}
