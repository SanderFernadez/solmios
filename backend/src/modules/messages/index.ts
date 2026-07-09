import { createModule, OrmRepository } from 'arckode-framework'
import { registerMessagesModels } from './model'
import { MessagesService } from './service'
import { MessagesController } from './controller'

export { MessagesService }
export type { MessageDTO, MessageUser } from './service'

export function MessagesModule() {
  return createModule({
    name: 'messages',
    version: '1.0.0',
    description: 'Chat interno del equipo — mensajes entre miembros del hotel',
    contract: {
      name: 'messages',
      version: '1.0.0',
      description: 'Internal team chat',
      actions: ['list', 'send', 'read', 'all'],
      events: ['onMessageSent'],
      tables: ['messages'],
      dependencies: [],
      rules: ['hotelId required', 'Users can only see their own conversations'],
    },
    create({ logger, orm, router, auth }) {
      if (!auth) throw new Error('messages: auth dependency required')
      registerMessagesModels(orm)
      const repo = new OrmRepository<any>(orm, 'Messages')
      const log = logger.child('messages')
      const service = new MessagesService(repo, log)
      const controller = new MessagesController(service)

      router.get('/api/messages', (req) => controller.conversations(req))
      router.get('/api/messages/all', (req) => controller.allConversations(req))
      router.get('/api/messages/:userId', (req) => controller.messagesWith(req))
      router.post('/api/messages', (req) => controller.send(req))
      router.put('/api/messages/:id/read', (req) => controller.markRead(req))

      log.info('Módulo messages v1.0 listo')
      return service
    },
  })
}
