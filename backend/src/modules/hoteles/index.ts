// hoteles/index.ts — PUERTA PÚBLICA
// Solo esto es visible para otros módulos y conectores.
// ⚠ REGLA: Append-only. No sacar ni modificar exports existentes.

import { createModule, OrmRepository } from 'arckode-framework'
import { registerHotelesModels } from './model'
import { HotelesService } from './service'
import { HotelesController } from './controller'
import type { HotelesDTO } from './types'

export { HotelesService }
export type { HotelesDTO, CreateHotelesDTO, UpdateHotelesDTO, HotelesQuery, HotelesPaginated } from './types'
export type { HotelesSockets } from './sockets'
export { HotelesValidator, CreateHotelesSchema, UpdateHotelesSchema } from './validators/schema'

export function HotelesModule() {
  return createModule({
    name: 'hoteles',
    version: '1.0.0',
    description: 'Módulo de hoteles',

    contract: {
      name: 'hoteles',
      version: '1.0.0',
      description: 'Módulo de hoteles',
      actions: ["list","getById","create","update","delete"],
      events: ["onHotelesCreated","onHotelesUpdated","onHotelesDeleted"],
      tables: ['hoteles'],
      dependencies: [],
      rules: ['No importar de otros módulos'],
    },

    create({ logger, orm, cache, router, auth }) {
      // Registrar modelo(s) — delegado a model.ts
      registerHotelesModels(orm)

      const repo = new OrmRepository<HotelesDTO>(orm, 'Hoteles')
      const log = logger.child('hoteles')
      const service = new HotelesService(repo, log, cache)
      const controller = new HotelesController(service, log)

      // Rutas públicas por defecto — agregar [auth.authenticate()] para proteger
      router.get('/api/hoteles', [auth.authenticate('hotel_admin', 'receptionist', 'super_admin')], (req) => controller.index(req))
      router.get('/api/hoteles/:id', [auth.authenticate('hotel_admin', 'receptionist', 'super_admin')], (req) => controller.show(req))
      router.post('/api/hoteles', [auth.authenticate('hotel_admin', 'super_admin')], (req) => controller.store(req))
      router.put('/api/hoteles/:id', [auth.authenticate('hotel_admin', 'super_admin')], (req) => controller.update(req))
      router.delete('/api/hoteles/:id', [auth.authenticate('hotel_admin', 'super_admin')], (req) => controller.destroy(req))

      log.info('Módulo hoteles listo')
      return service
    },
  })
}
