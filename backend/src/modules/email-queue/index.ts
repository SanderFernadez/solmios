import { createModule, OrmRepository } from 'arckode-framework'
import { EmailQueueService } from './service'
import { EmailQueueController } from './controller'
import type { EmailQueueDTO } from './types'
import { createPermissionGuard } from '../../infrastructure/auth/create-permission-guard'
import { createModuleGuard } from '../../infrastructure/auth/require-module'

export { EmailQueueService }
export type { EmailQueueDTO, EmailQueueQuery, EmailQueuePaginated, EmailQueueStatus } from './types'
export type { EmailQueueSockets } from './sockets'
export { EmailQueueValidator, ListEmailQueueSchema } from './validators/schema'
export { EmailQueueModel } from './model'

export function EmailQueueModule() {
  return createModule({
    name: 'email-queue',
    version: '1.0.0',
    description: 'Operación de la cola de emails: listar cola/fallidos y reencolar manualmente (envío/reintento lo hace EmailService)',
    contract: {
      name: 'email-queue',
      version: '1.0.0',
      description: 'Email queue operations: list by status + manual requeue, multi-tenant',
      actions: ['list', 'requeue'],
      events: ['onEmailRequeued'],
      tables: ['email_queue'],
      dependencies: [],
      rules: ['Ownership por hotelId', 'Requeue resetea status/attempts para el worker'],
    },
    create({ logger, orm, cache, router, auth }) {
      if (!auth) throw new Error('email-queue: auth dependency required')
      // La tabla `email_queue` la modela y registra `shared/models.ts` (dueño: EmailService).
      // Acá solo la operamos vía repositorio; NO se redefine el modelo (anti dual-model).
      const repo = new OrmRepository<EmailQueueDTO>(orm, 'EmailQueue')
      const log = logger.child('email-queue')
      const userRepo = new OrmRepository<any>(orm, 'Users')
      const service = new EmailQueueService(repo, log, cache, userRepo, auth)
      const controller = new EmailQueueController(service, log)

      const roleRepo = new OrmRepository<any>(orm, 'Roles')
      const permGuard = createPermissionGuard(auth, roleRepo)
      const moduleGuard = createModuleGuard(orm)
      const guard = (m: string, a: string) => [...permGuard(m, a), moduleGuard('settings.email-queue')]

      router.get('/api/email-queue', guard('settings', 'view'), (req) => controller.index(req))
      router.post('/api/email-queue/:id/requeue', guard('settings', 'edit'), (req) => controller.requeue(req))

      log.info('Modulo email-queue listo')
      return service
    },
  })
}
