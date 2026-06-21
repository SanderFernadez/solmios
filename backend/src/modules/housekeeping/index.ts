// housekeeping/index.ts — PUERTA PÚBLICA
// Solo esto es visible para otros módulos y conectores.
// ⚠ REGLA: Append-only. No sacar ni modificar exports existentes.

import { createModule, OrmRepository } from 'arckode-framework'
import { registerHousekeepingModels } from './model'
import { HousekeepingService } from './service'
import { HousekeepingController } from './controller'
import type { HousekeepingDTO } from './types'

export { HousekeepingService }
export type { HousekeepingDTO, CreateHousekeepingDTO, UpdateHousekeepingDTO, HousekeepingQuery, HousekeepingPaginated } from './types'
export type { HousekeepingSockets } from './sockets'
export { HousekeepingValidator, CreateHousekeepingSchema, UpdateHousekeepingSchema } from './validators/schema'

export function HousekeepingModule() {
  return createModule({
    name: 'housekeeping',
    version: '1.0.0',
    description: 'Módulo de housekeeping',

    contract: {
      name: 'housekeeping',
      version: '1.0.0',
      description: 'Módulo de housekeeping',
      actions: ["list","getById","create","update","delete"],
      events: ["onHousekeepingCreated","onHousekeepingUpdated","onHousekeepingDeleted"],
      tables: ['housekeeping'],
      dependencies: [],
      rules: ['No importar de otros módulos'],
    },

    create({ logger, orm, cache, router, auth }) {
      // Registrar modelo(s) — delegado a model.ts
      registerHousekeepingModels(orm)

      const repo = new OrmRepository<HousekeepingDTO>(orm, 'Housekeeping')
      const log = logger.child('housekeeping')
      const service = new HousekeepingService(repo, log, cache)
      const controller = new HousekeepingController(service, log)

      // Rutas públicas por defecto — agregar [auth.authenticate()] para proteger
      router.get('/api/housekeeping', [auth.authenticate('hotel_admin', 'receptionist', 'super_admin')], (req) => controller.index(req))
      router.get('/api/housekeeping/:id', [auth.authenticate('hotel_admin', 'receptionist', 'super_admin')], (req) => controller.show(req))
      router.post('/api/housekeeping', [auth.authenticate('hotel_admin', 'super_admin')], (req) => controller.store(req))
      router.put('/api/housekeeping/:id', [auth.authenticate('hotel_admin', 'super_admin')], (req) => controller.update(req))
      router.delete('/api/housekeeping/:id', [auth.authenticate('hotel_admin', 'super_admin')], (req) => controller.destroy(req))

      log.info('Módulo housekeeping listo')
      return service
    },
  })
}
