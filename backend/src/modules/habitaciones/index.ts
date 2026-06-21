// habitaciones/index.ts — PUERTA PÚBLICA
// Solo esto es visible para otros módulos y conectores.
// ⚠ REGLA: Append-only. No sacar ni modificar exports existentes.

import { createModule, OrmRepository } from 'arckode-framework'
import { registerHabitacionesModels } from './model'
import { HabitacionesService } from './service'
import { HabitacionesController } from './controller'
import type { HabitacionesDTO } from './types'

export { HabitacionesService }
export type { HabitacionesDTO, CreateHabitacionesDTO, UpdateHabitacionesDTO, HabitacionesQuery, HabitacionesPaginated } from './types'
export type { HabitacionesSockets } from './sockets'
export { HabitacionesValidator, CreateHabitacionesSchema, UpdateHabitacionesSchema } from './validators/schema'

export function HabitacionesModule() {
  return createModule({
    name: 'habitaciones',
    version: '1.0.0',
    description: 'Módulo de habitaciones',

    contract: {
      name: 'habitaciones',
      version: '1.0.0',
      description: 'Módulo de habitaciones',
      actions: ["list","getById","create","update","delete"],
      events: ["onHabitacionesCreated","onHabitacionesUpdated","onHabitacionesDeleted"],
      tables: ['habitaciones'],
      dependencies: [],
      rules: ['No importar de otros módulos'],
    },

    create({ logger, orm, cache, router, auth }) {
      // Registrar modelo(s) — delegado a model.ts
      registerHabitacionesModels(orm)

      const repo = new OrmRepository<HabitacionesDTO>(orm, 'Rooms')
      const log = logger.child('habitaciones')
      const service = new HabitacionesService(repo, log, cache)
      const controller = new HabitacionesController(service, log)

      // Rutas públicas por defecto — agregar [auth.authenticate()] para proteger
      router.get('/api/habitaciones', [auth.authenticate('hotel_admin', 'receptionist', 'super_admin')], (req) => controller.index(req))
      router.get('/api/habitaciones/:id', [auth.authenticate('hotel_admin', 'receptionist', 'super_admin')], (req) => controller.show(req))
      router.post('/api/habitaciones', [auth.authenticate('hotel_admin', 'super_admin')], (req) => controller.store(req))
      router.put('/api/habitaciones/:id', [auth.authenticate('hotel_admin', 'super_admin')], (req) => controller.update(req))
      router.delete('/api/habitaciones/:id', [auth.authenticate('hotel_admin', 'super_admin')], (req) => controller.destroy(req))

      log.info('Módulo habitaciones listo')
      return service
    },
  })
}
