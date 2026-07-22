// webhooks/index.ts — PUERTA PÚBLICA
// Solo esto es visible para otros módulos y conectores.
// ⚠ REGLA: Append-only. No sacar ni modificar exports existentes.
//
// Webhooks salientes: subscriptions (hotel configura URL + eventos) + deliveries (historial).
// `dispatch(hotelId, event, payload)` es el puerto que consumen los connectors de otros módulos
// de negocio (ej. `reservas-webhooks.ts`) para avisar un evento — webhooks nunca importa esos
// módulos, son ELLOS los que, vía connector, llaman a `webhooks.dispatch(...)`.
//
// Auth/gestión: mismo criterio que `apikeys` — `createPermissionGuard` con permiso `settings`
// (sin `requireUserType`), ownership por `hotelId` verificado en el service. Cualquier usuario
// con `settings:*` (super_admin o hotel_admin de su propio hotel) puede gestionar SUS webhooks.

import { createModule, OrmRepository } from 'arckode-framework'
import { registerWebhooksModels } from './model'
import { WebhooksService } from './service'
import { WebhooksController } from './controller'
import type { WebhookSubscriptionDTO, WebhookDeliveryDTO } from './types'
import { createPermissionGuard } from '../../infrastructure/auth/create-permission-guard'

export { WebhooksService }
export type {
  WebhookSubscriptionDTO, WebhookSubscriptionView, CreateWebhookSubscriptionDTO, UpdateWebhookSubscriptionDTO,
  WebhookSubscriptionsQuery, WebhookSubscriptionsPaginated, WebhookDeliveryDTO, CurrentUser,
} from './types'
export type { WebhooksSockets } from './sockets'
export { WebhooksValidator, CreateWebhookSubscriptionSchema, UpdateWebhookSubscriptionSchema } from './validators/schema'

export function WebhooksModule() {
  return createModule({
    name: 'webhooks',
    version: '1.0.0',
    description: 'Webhooks salientes: subscriptions por hotel + historial de entregas (firma HMAC-SHA256)',

    contract: {
      name: 'webhooks',
      version: '1.0.0',
      description: 'Webhook subscriptions + deliveries. dispatch() lo consumen connectors de otros módulos.',
      actions: ['list', 'getById', 'create', 'update', 'delete', 'test', 'dispatch'],
      events: [],
      tables: ['webhook_subscriptions', 'webhook_deliveries'],
      dependencies: [],
      rules: ['Ownership por hotelId', 'Secreto generado server-side, expuesto una sola vez en create'],
    },

    create({ logger, orm, cache, router, auth }) {
      if (!auth) throw new Error('webhooks: auth dependency required')
      registerWebhooksModels(orm)

      const repo = new OrmRepository<WebhookSubscriptionDTO>(orm, 'WebhookSubscription')
      const deliveryRepo = new OrmRepository<WebhookDeliveryDTO>(orm, 'WebhookDelivery')
      const log = logger.child('webhooks')
      const service = new WebhooksService(repo, deliveryRepo, log, cache)
      const controller = new WebhooksController(service, log)

      const roleRepo = new OrmRepository<any>(orm, 'Roles')
      const guard = createPermissionGuard(auth, roleRepo)

      router.get('/api/webhooks', guard('settings', 'view'), (req) => controller.index(req))
      router.get('/api/webhooks/:id', guard('settings', 'view'), (req) => controller.show(req))
      router.post('/api/webhooks', guard('settings', 'create'), (req) => controller.store(req))
      router.put('/api/webhooks/:id', guard('settings', 'edit'), (req) => controller.update(req))
      router.delete('/api/webhooks/:id', guard('settings', 'delete'), (req) => controller.destroy(req))
      router.post('/api/webhooks/:id/test', guard('settings', 'edit'), (req) => controller.test(req))

      log.info('Módulo webhooks listo')
      return service
    },
  })
}
