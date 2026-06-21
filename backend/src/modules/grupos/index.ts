// grupos/index.ts — PUERTA PÚBLICA
// Solo esto es visible para otros módulos y conectores.
// ⚠ REGLA: Append-only. No sacar ni modificar exports existentes.

import { createModule, OrmRepository } from 'arckode-framework'
import { registerGruposModels } from './model'
import { GruposService } from './service'
import { GruposController } from './controller'
import type { GruposDTO } from './types'

export { GruposService }
export type { GruposDTO, CreateGruposDTO, UpdateGruposDTO, GruposQuery, GruposPaginated } from './types'
export type { GruposSockets } from './sockets'
export { GruposValidator, CreateGruposSchema, UpdateGruposSchema } from './validators/schema'

export function GruposModule() {
  return createModule({
    name: 'grupos',
    version: '1.0.0',
    description: 'Módulo de grupos',

    contract: {
      name: 'grupos',
      version: '1.0.0',
      description: 'Módulo de grupos',
      actions: ["list","getById","create","update","delete"],
      events: ["onGruposCreated","onGruposUpdated","onGruposDeleted"],
      tables: ['grupos'],
      dependencies: [],
      rules: ['No importar de otros módulos'],
    },

    create({ logger, orm, cache, router, auth }) {
      // Registrar modelo(s) — delegado a model.ts
      registerGruposModels(orm)

      const repo = new OrmRepository<GruposDTO>(orm, 'Groups')
      const log = logger.child('grupos')
      const service = new GruposService(repo, log, cache)
      const controller = new GruposController(service, log)

      // Rutas públicas por defecto — agregar [auth.authenticate()] para proteger
      router.get('/api/grupos', [auth.authenticate('hotel_admin', 'receptionist', 'super_admin')], (req) => controller.index(req))
      router.get('/api/grupos/:id', [auth.authenticate('hotel_admin', 'receptionist', 'super_admin')], (req) => controller.show(req))
      router.post('/api/grupos', [auth.authenticate('hotel_admin', 'super_admin')], (req) => controller.store(req))
      router.put('/api/grupos/:id', [auth.authenticate('hotel_admin', 'super_admin')], (req) => controller.update(req))
      router.delete('/api/grupos/:id', [auth.authenticate('hotel_admin', 'super_admin')], (req) => controller.destroy(req))

      log.info('Módulo grupos listo')
      return service
    },
  })
}
