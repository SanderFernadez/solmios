// payments/index.ts — PUERTA PÚBLICA del módulo Payments
// Cobros, pagos, enlaces de pago, depósitos, conciliación

import { createModule, OrmRepository } from 'arckode-framework'
import { registerPaymentsModels } from './model'
import { PaymentsService } from './service'
import { PaymentsController } from './controller'
import type { PaymentDTO, PaymentLinkDTO, DepositDTO } from './types'
import { createPermissionGuard } from '../../infrastructure/auth/create-permission-guard'

export { PaymentsService }
export type { PaymentDTO, CreatePaymentDTO, ChargeCardDTO, PaymentLinkDTO, CreatePaymentLinkDTO, DepositDTO, CreateDepositDTO, RefundDepositDTO, PaymentsQuery, PaymentsPaginated, ReconciliationEntry, ReconciliationResult } from './types'
export type { PaymentsSockets } from './sockets'
export { PaymentsValidator, CreatePaymentSchema, ChargeCardSchema, CreatePaymentLinkSchema, CreateDepositSchema, RefundDepositSchema, ReconcileSchema } from './validators/schema'

export function PaymentsModule() {
  return createModule({
    name: 'payments',
    version: '1.0.0',
    description: 'Payments: card charging, payment links, deposits, reconciliation',

    contract: {
      name: 'payments',
      version: '1.0.0',
      description: 'Payments: card charging, payment links, deposits, reconciliation',
      actions: ['createPayment', 'chargeCard', 'refund', 'listPayments', 'createLink', 'createDeposit', 'refundDeposit', 'releaseDeposit', 'reconcile'],
      events: ['onPaymentCreated', 'onPaymentCompleted', 'onPaymentFailed', 'onRefundProcessed', 'onDepositCreated', 'onDepositReleased'],
      tables: ['payments', 'payment_links', 'deposits'],
      dependencies: ['folios', 'facturas'],
      rules: ['No importar de otros módulos directamente'],
    },

    create({ logger, orm, cache, router, auth }: { logger: any; orm: any; cache: any; router: any; auth?: any }) {
      registerPaymentsModels(orm)

      const paymentRepo = new OrmRepository<PaymentDTO>(orm, 'Payment')
      const linkRepo = new OrmRepository<PaymentLinkDTO>(orm, 'PaymentLink')
      const depositRepo = new OrmRepository<DepositDTO>(orm, 'Deposit')

      const log = logger.child('payments')
      const userRepo = new OrmRepository<any>(orm, 'Users')
      const service = new PaymentsService(paymentRepo, linkRepo, depositRepo, log, cache, auth, userRepo)
      const controller = new PaymentsController(service, log)

      // Admin routes (protegidas con auth)
      if (auth) {
        const roleRepo = new OrmRepository<any>(orm, 'Roles')
        const guard = createPermissionGuard(auth, roleRepo)

        // Payments
        router.get('/api/payments', guard('billing', 'view'), (req: any) => controller.listPayments(req))
        router.get('/api/payments/:id', guard('billing', 'view'), (req: any) => controller.getPayment(req))
        router.post('/api/payments', guard('billing', 'create'), (req: any) => controller.createPayment(req))
        router.post('/api/payments/charge', guard('billing', 'create'), (req: any) => controller.chargeCard(req))
        router.post('/api/payments/:id/refund', guard('billing', 'create'), (req: any) => controller.refund(req))

        // Payment Links
        router.get('/api/payment-links', guard('billing', 'view'), (req: any) => controller.listLinks(req))
        router.post('/api/payment-links', guard('billing', 'create'), (req: any) => controller.createLink(req))
        router.delete('/api/payment-links/:id', guard('billing', 'create'), (req: any) => controller.cancelLink(req))

        // Deposits
        router.get('/api/deposits', guard('billing', 'view'), (req: any) => controller.listDeposits(req))
        router.get('/api/deposits/:id', guard('billing', 'view'), (req: any) => controller.getDeposit(req))
        router.post('/api/deposits', guard('billing', 'create'), (req: any) => controller.createDeposit(req))
        router.post('/api/deposits/:id/refund', guard('billing', 'create'), (req: any) => controller.refundDeposit(req))
        router.post('/api/deposits/:id/release', guard('billing', 'create'), (req: any) => controller.releaseDeposit(req))

        // Reconciliation
        router.post('/api/billing/reconciliation', guard('billing', 'edit'), (req: any) => controller.reconcile(req))
      }

      // Public routes
      router.get('/api/public/payment-links/:token', (req: any) => controller.getLinkByToken(req))
      router.post('/api/webhooks/stripe', (req: any) => controller.handleWebhook(req))

      // Initialize Stripe if configured
      const stripeKey = process.env.STRIPE_SECRET_KEY
      const stripeWebhook = process.env.STRIPE_WEBHOOK_SECRET
      if (stripeKey && stripeWebhook) {
        service.initStripe(stripeKey, stripeWebhook).catch(() => {})
      }

      log.info('Payments module ready')
      return service
    },
  })
}
