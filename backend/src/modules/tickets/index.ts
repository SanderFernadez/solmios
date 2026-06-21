// tickets/index.ts — PUERTA PÚBLICA
// Solo esto es visible para otros módulos y conectores.
// ⚠ REGLA: Append-only. No sacar ni modificar exports existentes.

import { createModule, OrmRepository } from 'arckode-framework'
import { registerTicketsModels } from './model'
import { TicketsService } from './service'
import { TicketsController } from './controller'
import type { TicketsDTO } from './types'

export { TicketsService }
export type { TicketsDTO, CreateTicketsDTO, UpdateTicketsDTO, TicketsQuery, TicketsPaginated } from './types'
export type { TicketsSockets } from './sockets'
export { TicketsValidator, CreateTicketsSchema, UpdateTicketsSchema } from './validators/schema'

export function TicketsModule() {
  return createModule({
    name: 'tickets',
    version: '1.0.0',
    description: 'Módulo de tickets',

    contract: {
      name: 'tickets',
      version: '1.0.0',
      description: 'Módulo de tickets',
      actions: ["list","getById","create","update","delete"],
      events: ["onTicketsCreated","onTicketsUpdated","onTicketsDeleted"],
      tables: ['tickets'],
      dependencies: [],
      rules: ['No importar de otros módulos'],
    },

    create({ logger, orm, cache, router, auth }) {
      // Registrar modelo(s) — delegado a model.ts
      registerTicketsModels(orm)

      const repo = new OrmRepository<TicketsDTO>(orm, 'Tickets')
      const log = logger.child('tickets')
      const service = new TicketsService(repo, log, cache)
      const controller = new TicketsController(service, log)

      // Rutas públicas por defecto — agregar [auth.authenticate()] para proteger
      router.get('/api/tickets', [auth.authenticate('hotel_admin', 'receptionist', 'super_admin')], (req) => controller.index(req))
      router.get('/api/tickets/:id', [auth.authenticate('hotel_admin', 'receptionist', 'super_admin')], (req) => controller.show(req))
      router.post('/api/tickets', [auth.authenticate('hotel_admin', 'super_admin')], (req) => controller.store(req))
      router.put('/api/tickets/:id', [auth.authenticate('hotel_admin', 'super_admin')], (req) => controller.update(req))
      router.delete('/api/tickets/:id', [auth.authenticate('hotel_admin', 'super_admin')], (req) => controller.destroy(req))

      log.info('Módulo tickets listo')
      return service
    },
  })
}
