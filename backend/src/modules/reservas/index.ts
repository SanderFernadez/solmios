// reservas/index.ts — PUERTA PÚBLICA
// Solo esto es visible para otros módulos y conectores.
// ⚠ REGLA: Append-only. No sacar ni modificar exports existentes.

import { createModule, OrmRepository } from 'arckode-framework'
import { registerReservasModels } from './model'
import { ReservasService } from './service'
import { ReservasController } from './controller'
import type { ReservasDTO } from './types'

export { ReservasService }
export type { ReservasDTO, CreateReservasDTO, UpdateReservasDTO, ReservasQuery, ReservasPaginated } from './types'
export type { ReservasSockets } from './sockets'
export { ReservasValidator, CreateReservasSchema, UpdateReservasSchema } from './validators/schema'

export function ReservasModule() {
  return createModule({
    name: 'reservas',
    version: '1.0.0',
    description: 'Módulo de reservas',

    contract: {
      name: 'reservas',
      version: '1.0.0',
      description: 'Módulo de reservas',
      actions: ["list","getById","create","update","delete"],
      events: ["onReservasCreated","onReservasUpdated","onReservasDeleted"],
      tables: ['reservas'],
      dependencies: [],
      rules: ['No importar de otros módulos'],
    },

    create({ logger, orm, cache, router, auth }) {
      // Registrar modelo(s) — delegado a model.ts
      registerReservasModels(orm)

      const repo = new OrmRepository<ReservasDTO>(orm, 'Reservations')
      const log = logger.child('reservas')
      const service = new ReservasService(repo, log, cache)
      const controller = new ReservasController(service, log)

      // Rutas públicas por defecto — agregar [auth.authenticate()] para proteger
      router.get('/api/reservas', [auth.authenticate('hotel_admin', 'receptionist', 'super_admin')], (req) => controller.index(req))
      router.get('/api/reservas/:id', [auth.authenticate('hotel_admin', 'receptionist', 'super_admin')], (req) => controller.show(req))
      router.post('/api/reservas', [auth.authenticate('hotel_admin', 'super_admin')], (req) => controller.store(req))
      router.put('/api/reservas/:id', [auth.authenticate('hotel_admin', 'super_admin')], (req) => controller.update(req))
      router.delete('/api/reservas/:id', [auth.authenticate('hotel_admin', 'super_admin')], (req) => controller.destroy(req))

      log.info('Módulo reservas listo')
      return service
    },
  })
}
