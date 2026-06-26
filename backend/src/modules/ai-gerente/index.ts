// ai-gerente/index.ts — M17 Gerente IA: asistente del gerente con datos reales del hotel.
import { createModule, OrmRepository } from 'arckode-framework'
import { registerAiGerenteModels } from './model'
import { AiGerenteService } from './service'
import { AiGerenteController } from './controller'
import type { AiGerenteDTO } from './types'

export { AiGerenteService }
export type { AiGerenteDTO, CreateAiGerenteDTO, UpdateAiGerenteDTO, AiGerenteQuery, AiGerentePaginated, AskRequest } from './types'
export type { AiGerenteSockets } from './sockets'

export function AiGerenteModule() {
  return createModule({
    name: 'ai-gerente',
    version: '1.0.0',
    description: 'M17 Gerente IA — asistente del gerente con datos reales del hotel',
    contract: {
      name: 'ai-gerente',
      version: '1.0.0',
      description: 'AI Manager: chat del gerente con KPIs reales + historial + feedback',
      actions: ['ask', 'list', 'feedback'],
      events: [],
      tables: ['ai_manager_interactions'],
      dependencies: [],
      rules: ['No importar de otros módulos', 'RepositoryAdapter<T>', 'Validación en controller'],
    },
    create({ logger, orm, cache, router, auth }) {
      if (!auth) throw new Error('ai-gerente: auth dependency required')
      registerAiGerenteModels(orm)

      const interactionRepo = new OrmRepository<AiGerenteDTO>(orm, 'AiManagerInteraction')
      const reservationRepo = new OrmRepository<any>(orm, 'Reservations')
      const roomRepo = new OrmRepository<any>(orm, 'Rooms')
      const hotelRepo = new OrmRepository<any>(orm, 'Hotels')
      const configRepo = new OrmRepository<any>(orm, 'Configuration')

      const log = logger.child('ai-gerente')
      const service = new AiGerenteService(interactionRepo, reservationRepo, roomRepo, hotelRepo, configRepo, log, cache)
      const controller = new AiGerenteController(service, log)

      const roles = ['hotel_admin', 'super_admin'] as const
      router.post('/api/ai/manager/ask', [auth.authenticate(...roles)], (req) => controller.ask(req))
      router.get('/api/ai/manager/interactions', [auth.authenticate(...roles)], (req) => controller.index(req))
      router.patch('/api/ai/manager/interactions/:id/feedback', [auth.authenticate(...roles)], (req) => controller.feedback(req))

      log.info('Módulo ai-gerente listo (M17 Gerente IA)')
      return service
    },
  })
}
