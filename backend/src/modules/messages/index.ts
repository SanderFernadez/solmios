// messages/index.ts — PUERTA PÚBLICA del módulo de chat interno.
// ⚠ REGLA: Append-only. No sacar ni modificar exports existentes.

import { createModule, OrmRepository } from 'arckode-framework'
import { registerMessagesModels } from './model'
import { MessagesService } from './service'
import { MessagesController } from './controller'
import type { MessageDTO } from './types'

export { MessagesService }
export type { MessageDTO, MessageUser, SendMessageDTO, Conversation } from './types'
export type { MessagesSockets } from './sockets'
export { MessagesValidator, SendMessageSchema } from './validators/schema'

/** Roles que pueden usar el chat interno: cualquier miembro autenticado del hotel. */
const STAFF_ROLES = ['hotel_admin', 'receptionist', 'housekeeper', 'maintenance', 'super_admin'] as const

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
      events: ['onMessageSent', 'onMessageRead'],
      tables: ['messages'],
      dependencies: [],
      rules: ['Authentication required', 'hotelId from JWT', 'Users only see their own conversations'],
    },
    create({ logger, orm, router, auth }) {
      if (!auth) throw new Error('messages: auth dependency required')
      registerMessagesModels(orm)
      const repo = new OrmRepository<MessageDTO>(orm, 'Messages')
      const log = logger.child('messages')
      const service = new MessagesService(repo, log)
      const controller = new MessagesController(service)

      // Las rutas nacían sin auth: cualquiera sin token listaba los mensajes del hotel, y el
      // controller leía `req.user` (undefined). El chat es interno — siempre autenticado.
      const staff = [auth.authenticate(...STAFF_ROLES)]

      router.get('/api/messages', staff, (req) => controller.conversations(req))
      router.get('/api/messages/all', staff, (req) => controller.allConversations(req))
      router.get('/api/messages/:userId', staff, (req) => controller.messagesWith(req))
      router.post('/api/messages', staff, (req) => controller.send(req))
      router.put('/api/messages/:id/read', staff, (req) => controller.markRead(req))

      log.info('Módulo messages v1.0 listo')
      return service
    },
  })
}
