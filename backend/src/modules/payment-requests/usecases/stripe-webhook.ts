// payment-requests/usecases/stripe-webhook.ts — Procesamiento del webhook Stripe.
// Extraído del service para mantenerlo <200 líneas (no God Object).
// Es un endpoint público: la autoridad es la FIRMA de Stripe (no un JWT/user),
// por eso no hay assertOwnership aquí — el eventId se resuelve desde el PaymentRequest.

import type { RepositoryAdapter, Logger } from 'arckode-framework'
import { StripeService } from '../../../services/stripe-service'
import type { PaymentRequestDTO, WebhookResult } from '../types'
import type { PaymentRequestsSockets } from '../sockets'

export interface WebhookDeps {
  repo: RepositoryAdapter<PaymentRequestDTO>
  reservationRepo: RepositoryAdapter<any>
  folioRepo: RepositoryAdapter<any>
  folioChargeRepo: RepositoryAdapter<any>
  logger: Logger
  sockets: PaymentRequestsSockets
}

/** Procesa el webhook Stripe: marca el PaymentRequest paid + aplica el pago a reserva/folio. */
export async function processStripeWebhook(deps: WebhookDeps, rawBody: string, signature: string): Promise<WebhookResult> {
  const { repo, reservationRepo, folioRepo, folioChargeRepo, logger, sockets } = deps

  if (!StripeService.isConfigured()) return { status: 503, error: 'Stripe no configurado' } as any
  if (!signature) return { status: 400, error: 'Falta stripe-signature' } as any

  let event: any
  try {
    event = await StripeService.verifyWebhook(rawBody, signature)
  } catch (e: any) {
    logger.warn('Stripe webhook signature failed', { error: e.message })
    return { status: 400, error: 'Firma inválida', detail: e.message } as any
  }

  try {
    switch (event.type) {
      case 'checkout.session.completed': {
        const session = event.data.object as any
        const paymentRequestId = session.metadata?.paymentRequestId
        if (paymentRequestId) {
          const pr = await repo.findById(paymentRequestId)
          if (pr && pr.status !== 'paid') {
            await repo.update(paymentRequestId, {
              status: 'paid', stripeSessionId: session.id, paidAt: new Date().toISOString(),
            } as Partial<PaymentRequestDTO>)
            await applyPaymentBridge(reservationRepo, folioRepo, folioChargeRepo, pr, session)
            const updated = await repo.findById(paymentRequestId) as PaymentRequestDTO
            await sockets.onPaymentRequestPaid?.(updated)
            logger.info('Stripe payment completed + applied', { paymentRequestId, amountPaid: Math.abs(Number(session.amount_total ?? pr.amount ?? 0)) / 100 })
          }
        }
        break
      }
      case 'checkout.session.expired': {
        const session = event.data.object as any
        const paymentRequestId = session.metadata?.paymentRequestId
        if (paymentRequestId) await repo.update(paymentRequestId, { status: 'expired' } as Partial<PaymentRequestDTO>)
        break
      }
      case 'payment_intent.payment_failed':
        logger.warn('Stripe payment failed', { event })
        break
      default:
        break
    }
    return { received: true }
  } catch (e: any) {
    logger.error('Stripe webhook handler failed', e)
    return { status: 500, error: 'Internal error' } as any
  }
}

/** Bridge: aplicar el pago a la reserva (deposit/pendingAmount/status) + folio (cargo payment). */
async function applyPaymentBridge(
  reservationRepo: RepositoryAdapter<any>,
  folioRepo: RepositoryAdapter<any>,
  folioChargeRepo: RepositoryAdapter<any>,
  pr: PaymentRequestDTO,
  session: any,
): Promise<void> {
  const amountPaid = Math.abs(Number(session.amount_total ?? pr.amount ?? 0)) / 100
  const reservationId = session.metadata?.reservationId || pr.reservationId
  const hotelId = session.metadata?.hotelId || pr.hotelId
  if (!reservationId) return

  const resRows = await reservationRepo.findMany({ id: reservationId })
  const res = resRows[0]
  if (res) {
    const newDeposit = Number(res.deposit || 0) + amountPaid
    const total = Number(res.totalAmount || 0)
    const update: any = {
      deposit: newDeposit,
      paymentMethod: 'stripe',
      pendingAmount: Math.max(0, total - newDeposit),
    }
    if (res.status === 'pending' && newDeposit >= total) update.status = 'confirmed'
    await reservationRepo.update(reservationId, update)
  }

  const folios = await folioRepo.findMany({ reservationId })
  const openFolio = folios.find((f: any) => f.status === 'open')
  if (openFolio && amountPaid > 0) {
    await folioChargeRepo.create({
      folioId: openFolio.id, hotelId,
      description: `Pago Stripe · Ref ${session.payment_intent || session.id}`,
      category: 'payment', kind: 'payment', quantity: 1,
      amount: -amountPaid, taxes: 0, total: -amountPaid, source: 'stripe',
      postedAt: new Date().toISOString(),
    } as any)
  }
}
