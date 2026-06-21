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
    version: '2.0.0',
    description: 'Módulo de tickets — soporte y incidencias',
    contract: {
      name: 'tickets',
      version: '2.0.0',
      description: 'Support tickets with ownership and pagination',
      actions: ['list', 'getById', 'create', 'update', 'delete'],
      events: ['onTicketsCreated', 'onTicketsUpdated', 'onTicketsDeleted'],
      tables: ['tickets'],
      dependencies: [],
      rules: ['Ownership check required', 'hotelId/userId not updatable'],
    },
    create({ logger, orm, cache, router, auth }) {
      if (!auth) throw new Error('tickets: auth dependency required')
      registerTicketsModels(orm)
      const repo = new OrmRepository<TicketsDTO>(orm, 'Tickets')
      const log = logger.child('tickets')
      const service = new TicketsService(repo, log, cache, auth)
      const controller = new TicketsController(service, log)

      router.get('/api/tickets', [auth.authenticate('hotel_admin', 'receptionist', 'super_admin')], (req) => controller.index(req))
      router.get('/api/tickets/:id', [auth.authenticate('hotel_admin', 'receptionist', 'super_admin')], (req) => controller.show(req))
      router.post('/api/tickets', [auth.authenticate('hotel_admin', 'receptionist', 'super_admin')], (req) => controller.store(req))
      router.put('/api/tickets/:id', [auth.authenticate('hotel_admin', 'super_admin')], (req) => controller.update(req))
      router.delete('/api/tickets/:id', [auth.authenticate('hotel_admin', 'super_admin')], (req) => controller.destroy(req))

      log.info('Módulo tickets v2 listo')
      return service
    },
  })
}
