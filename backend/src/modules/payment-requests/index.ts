// payment-requests/index.ts — PUERTA PÚBLICA del módulo.
// Solo esto es visible para otros módulos y conectores.
// ⚠ REGLA: Append-only. No sacar ni modificar exports existentes.
//
// payment-requests = solicitud de pago pre-pago con Stripe Checkout para una reserva (legacy).
// Distinto del módulo `payments` (pagos registrados vinculados a folios). No fusionar.

import { createModule, OrmRepository } from 'arckode-framework'
import { registerPaymentRequestModels } from './model'
import { PaymentRequestsService } from './service'
import { PaymentRequestsController } from './controller'
import type { PaymentRequestDTO } from './types'

export { PaymentRequestsService }
export type {
  PaymentRequestDTO, CreatePaymentRequestDTO, UpdatePaymentRequestDTO,
  PaymentRequestQuery, PaymentRequestStatus, CurrentUser,
  StripeStatusResult, CheckoutResult, WebhookResult,
} from './types'
export type { PaymentRequestsSockets } from './sockets'
export { CreatePaymentRequestSchema, UpdatePaymentRequestSchema, PaymentRequestsValidator } from './validators/schema'

export function PaymentRequestsModule() {
  return createModule({
    name: 'payment-requests',
    version: '1.0.0',
    description: 'Solicitudes de pago (Stripe Checkout) por reserva + webhook',

    contract: {
      name: 'payment-requests',
      version: '1.0.0',
      description: 'Solicitud de pago pre-pago con Stripe Checkout; webhook aplica el pago a reserva+folio',
      actions: ['list', 'getById', 'create', 'update', 'delete', 'stripeStatus', 'createCheckout', 'handleWebhook'],
      events: ['onPaymentRequestCreated', 'onPaymentRequestUpdated', 'onPaymentRequestDeleted', 'onPaymentRequestPaid'],
      tables: ['payment_requests'],
      dependencies: [],
      rules: [
        'hotelId forzado del JWT en create (P0 IDOR)',
        'assertOwnership en update/delete (P0 IDOR CR-25/26)',
        'handleWebhook aplica pago a Reservations/FolioCharges (DEUDA F10: mover a conector reactivo)',
      ],
    },

    create({ logger, orm, router, auth }) {
      if (!auth) throw new Error('payment-requests: auth dependency required')
      registerPaymentRequestModels(orm)

      const repo = new OrmRepository<PaymentRequestDTO>(orm, 'PaymentRequests')
      // Repos cross-table para el webhook bridge (deuda F10: conector reactivo futuro).
      const reservationRepo = new OrmRepository<any>(orm, 'Reservations')
      const folioRepo = new OrmRepository<any>(orm, 'Folios')
      const folioChargeRepo = new OrmRepository<any>(orm, 'FolioCharges')
      const userRepo = new OrmRepository<any>(orm, 'Users')
      const log = logger.child('payment-requests')
      const service = new PaymentRequestsService(repo, reservationRepo, folioRepo, folioChargeRepo, userRepo, log, auth!)
      const controller = new PaymentRequestsController(service, log)

      const READ = ['hotel_admin', 'receptionist', 'super_admin']
      const WRITE = ['hotel_admin', 'super_admin']

      router.get('/api/payment-requests', [auth.authenticate(...READ)], (req) => controller.index(req))
      router.get('/api/payment-requests/:id', [auth.authenticate(...READ)], (req) => controller.show(req))
      router.post('/api/payment-requests', [auth.authenticate(...READ)], (req) => controller.store(req))
      router.put('/api/payment-requests/:id', [auth.authenticate(...WRITE)], (req) => controller.update(req))
      router.delete('/api/payment-requests/:id', [auth.authenticate(...WRITE)], (req) => controller.destroy(req))
      router.get('/api/stripe/status', [auth.authenticate(...READ)], (req) => controller.stripeStatus(req))
      router.post('/api/payment-requests/:id/create-checkout', [auth.authenticate(...READ)], (req) => controller.createCheckout(req))
      // Webhook público: sin auth, firma Stripe verificada en el service.
      router.post('/api/stripe/webhook', (req) => controller.webhook(req))

      log.info('Módulo payment-requests listo')
      return service
    },
  })
}
