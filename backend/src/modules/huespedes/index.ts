// huespedes/index.ts — PUERTA PÚBLICA
// Solo esto es visible para otros módulos y conectores.
// ⚠ REGLA: Append-only. No sacar ni modificar exports existentes.

import { createModule, OrmRepository } from 'arckode-framework'
import { registerHuespedesModels } from './model'
import { HuespedesService } from './service'
import { HuespedesController } from './controller'
import type { HuespedesDTO } from './types'

export { HuespedesService }
export type { HuespedesDTO, CreateHuespedesDTO, UpdateHuespedesDTO, HuespedesQuery, HuespedesPaginated } from './types'
export type { HuespedesSockets } from './sockets'
export { HuespedesValidator, CreateHuespedesSchema, UpdateHuespedesSchema } from './validators/schema'

export function HuespedesModule() {
  return createModule({
    name: 'huespedes',
    version: '1.0.0',
    description: 'Módulo de huespedes',

    contract: {
      name: 'huespedes',
      version: '1.0.0',
      description: 'Módulo de huespedes',
      actions: ["list","getById","create","update","delete"],
      events: ["onHuespedesCreated","onHuespedesUpdated","onHuespedesDeleted"],
      tables: ['huespedes'],
      dependencies: [],
      rules: ['No importar de otros módulos'],
    },

    create({ logger, orm, cache, router, auth }) {
      if (!auth) throw new Error('huespedes: auth dependency required')
      // Registrar modelo(s) — delegado a model.ts
      registerHuespedesModels(orm)

      const repo = new OrmRepository<HuespedesDTO>(orm, 'Guests')
      const userRepo = new OrmRepository<any>(orm, 'Users')
      const log = logger.child('huespedes')
      const service = new HuespedesService(repo, userRepo, log, cache, auth)
      const controller = new HuespedesController(service, log)

      // Rutas públicas por defecto — agregar [auth.authenticate()] para proteger
      router.get('/api/huespedes', [auth.authenticate('hotel_admin', 'receptionist', 'super_admin')], (req) => controller.index(req))
      router.get('/api/huespedes/:id', [auth.authenticate('hotel_admin', 'receptionist', 'super_admin')], (req) => controller.show(req))
      router.post('/api/huespedes', [auth.authenticate('hotel_admin', 'super_admin')], (req) => controller.store(req))
      router.put('/api/huespedes/:id', [auth.authenticate('hotel_admin', 'super_admin')], (req) => controller.update(req))
      router.delete('/api/huespedes/:id', [auth.authenticate('hotel_admin', 'super_admin')], (req) => controller.destroy(req))

      log.info('Módulo huespedes listo')
      return service
    },
  })
}
