// mantenimiento/index.ts — PUERTA PÚBLICA
// Solo esto es visible para otros módulos y conectores.
// ⚠ REGLA: Append-only. No sacar ni modificar exports existentes.

import { createModule, OrmRepository } from 'arckode-framework'
import { registerMantenimientoModels } from './model'
import { MantenimientoService } from './service'
import { MantenimientoController } from './controller'
import type { MantenimientoDTO } from './types'

export { MantenimientoService }
export type { MantenimientoDTO, CreateMantenimientoDTO, UpdateMantenimientoDTO, MantenimientoQuery, MantenimientoPaginated } from './types'
export type { MantenimientoSockets } from './sockets'
export { MantenimientoValidator, CreateMantenimientoSchema, UpdateMantenimientoSchema } from './validators/schema'

export function MantenimientoModule() {
  return createModule({
    name: 'mantenimiento',
    version: '1.0.0',
    description: 'Módulo de mantenimiento',

    contract: {
      name: 'mantenimiento',
      version: '1.0.0',
      description: 'Módulo de mantenimiento',
      actions: ["list","getById","create","update","delete"],
      events: ["onMantenimientoCreated","onMantenimientoUpdated","onMantenimientoDeleted"],
      tables: ['mantenimiento'],
      dependencies: [],
      rules: ['No importar de otros módulos'],
    },

    create({ logger, orm, cache, router, auth }) {
      // Registrar modelo(s) — delegado a model.ts
      registerMantenimientoModels(orm)

      const repo = new OrmRepository<MantenimientoDTO>(orm, 'Maintenance')
      const log = logger.child('mantenimiento')
      const service = new MantenimientoService(repo, log, cache)
      const controller = new MantenimientoController(service, log)

      // Rutas públicas por defecto — agregar [auth.authenticate()] para proteger
      router.get('/api/mantenimiento', [auth.authenticate('hotel_admin', 'receptionist', 'super_admin')], (req) => controller.index(req))
      router.get('/api/mantenimiento/:id', [auth.authenticate('hotel_admin', 'receptionist', 'super_admin')], (req) => controller.show(req))
      router.post('/api/mantenimiento', [auth.authenticate('hotel_admin', 'super_admin')], (req) => controller.store(req))
      router.put('/api/mantenimiento/:id', [auth.authenticate('hotel_admin', 'super_admin')], (req) => controller.update(req))
      router.delete('/api/mantenimiento/:id', [auth.authenticate('hotel_admin', 'super_admin')], (req) => controller.destroy(req))

      log.info('Módulo mantenimiento listo')
      return service
    },
  })
}
