// pushtokens/index.ts — PUERTA PÚBLICA
// Solo esto es visible para otros módulos y conectores.
// ⚠ REGLA: Append-only. No sacar ni modificar exports existentes.

import { createModule, OrmRepository } from 'arckode-framework'
import { registerPushTokensModels } from './model'
import { PushTokensService } from './service'
import { PushTokensController } from './controller'
import type { PushTokenDTO } from './types'

export { PushTokensService }
export type {
  PushTokenDTO,
  RegisterPushTokenDTO,
  PushUser,
  PushNotification,
  PushSender,
  PushSendResult,
  ChatPushInput,
  StaffDirectory,
} from './types'
export { PushTokensValidator, RegisterPushTokenSchema, UnregisterPushTokenSchema } from './validators/schema'

export function PushTokensModule() {
  return createModule({
    name: 'pushtokens',
    version: '1.0.0',
    description: 'Tokens de Firebase de cada teléfono, y los avisos que se les mandan',

    contract: {
      name: 'pushtokens',
      version: '1.0.0',
      description: 'Tokens de Firebase de cada teléfono, y los avisos que se les mandan',
      actions: ['register', 'unregister', 'notifyUser', 'notifyHotel'],
      events: [],
      tables: ['push_tokens'],
      dependencies: [],
      rules: ['No importar de otros módulos'],
    },

    create({ logger, orm, router, auth }) {
      if (!auth) throw new Error('pushtokens: auth dependency required')
      registerPushTokensModels(orm)

      const repo = new OrmRepository<PushTokenDTO>(orm, 'PushTokens')
      const log = logger.child('pushtokens')
      const service = new PushTokensService(repo, log)
      const controller = new PushTokensController(service, log)

      // Sin permiso especial: registrar el propio teléfono es parte de tener
      // sesión. El dueño sale del JWT, así que nadie toca el de otro.
      router.post('/api/push-tokens', [auth.authenticate()], (req) => controller.register(req))
      router.delete('/api/push-tokens', [auth.authenticate()], (req) => controller.unregister(req))
      // Listado para administrar dispositivos del hotel. Restringido a admin del hotel
      // (falla cerrado); el service filtra por hotelId del token → multi-tenant.
      router.get('/api/push-tokens', [auth.authenticate('hotel_admin', 'super_admin')], (req) => controller.list(req))

      log.info('Módulo pushtokens listo')
      return service
    },
  })
}
