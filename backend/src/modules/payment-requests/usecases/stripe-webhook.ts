// payment-requests/usecases/stripe-webhook.ts — Procesamiento del webhook Stripe.
// Extraído del service para mantenerlo <200 líneas (no God Object).
// Es un endpoint público: la autoridad es la FIRMA de Stripe (no un JWT/user),
// por eso no hay assertOwnership aquí — el eventId se resuelve desde el PaymentRequest.

import type { RepositoryAdapter, Logger } from 'arckode-framework'
import { StripeService } from '../../../services/stripe-service'
import type { PaymentRequestDTO, WebhookResult } from '../types'
import type { PaymentRequestsSockets } from '../sockets'
import { recordStripePayment, type StripePaymentPort } from './payment-port'
import { webhookPaidEntry, webhookFailedEntry, type AuditEntry } from './audit'

export interface WebhookDeps {
  repo: RepositoryAdapter<PaymentRequestDTO>
  reservationRepo: RepositoryAdapter<any>
  folioRepo: RepositoryAdapter<any>
  folioChargeRepo: RepositoryAdapter<any>
  logger: Logger
  sockets: PaymentRequestsSockets
  paymentPort: StripePaymentPort | null
  /** SC-05: registra el cobro en el audit log. Lo pasa el service (`auditSafely` absorbe fallos). */
  audit?: (entry: AuditEntry) => Promise<void>
}

/** Procesa el webhook Stripe: marca el PaymentRequest paid + aplica el pago a reserva/folio. */
export async function processStripeWebhook(
  deps: WebhookDeps,
  hotelId: string,
  rawBody: string | Buffer,
  signature: string,
): Promise<WebhookResult> {
  const { repo, reservationRepo, folioRepo, folioChargeRepo, logger, sockets, paymentPort, audit } = deps

  if (!hotelId) return { status: 400, error: 'Falta el hotel en la ruta del webhook' } as any
  if (!(await StripeService.isConfigured(hotelId))) return { status: 503, error: 'El hotel no tiene Stripe configurado' } as any
  if (!signature) return { status: 400, error: 'Falta stripe-signature' } as any

  let event: any
  try {
    // La firma se verifica contra el secreto DE ESTE HOTEL (antes: uno global para todos).
    event = await StripeService.verifyWebhook(hotelId, rawBody, signature)
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
          // Idempotencia: este flujo tiene DOBLE barrera propia — el chequeo de estado
          // (pr.status !== 'paid') más `alreadyRecorded` en recordStripePayment, que no asienta
          // dos veces el mismo sessionId. No usa PaymentEventStore como los otros dos flujos
          // porque su asiento ya es idempotente por providerRef (el sessionId de Stripe).
          // El webhook del Hotel A no puede marcar como pagado un cobro del Hotel B.
          if (pr && pr.hotelId !== hotelId) {
            logger.error(`Webhook del hotel ${hotelId} quiso pagar el request ${paymentRequestId}, que no es suyo`)
            return { status: 403, error: 'El cobro no pertenece a este hotel' } as any
          }
          if (pr && pr.status !== 'paid') {
            const amountPaid = amountOf(session, pr)
            const hotelId = session.metadata?.hotelId || pr.hotelId
            const openFolio = await findOpenFolio(folioRepo, session.metadata?.reservationId || pr.reservationId)

            // El dinero se asienta PRIMERO. Si falla, el PaymentRequest queda `pending` y el
            // reintento de Stripe vuelve a correr todo desde cero, sin dejar plata sin asentar.
            const { alreadyRecorded } = await recordStripePayment(paymentPort, logger, {
              hotelId,
              amount: amountPaid,
              currency: (pr.currency || 'USD').toUpperCase(),
              stripeSessionId: session.id,
              stripePaymentId: session.payment_intent || '',
              folioId: openFolio?.id,
              description: `Pago Stripe · Reserva ${String(pr.reservationId || '').slice(0, 8)}`,
              reference: session.payment_intent || session.id,
            })

            // El bridge no es idempotente (suma al `deposit` de la reserva). Si el cobro ya estaba
            // asentado, este webhook es un reintento y la reserva/folio ya se actualizaron.
            if (!alreadyRecorded) {
              await applyPaymentBridge(reservationRepo, folioChargeRepo, pr, session, openFolio)
            }

            await repo.update(paymentRequestId, {
              status: 'paid', stripeSessionId: session.id, paidAt: new Date().toISOString(),
            } as Partial<PaymentRequestDTO>)
            const updated = await repo.findById(paymentRequestId) as PaymentRequestDTO
            await sockets.onPaymentRequestPaid?.(updated)
            await audit?.(webhookPaidEntry(updated, amountPaid))
            logger.info('Stripe payment completed + applied', { paymentRequestId, amountPaid })
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
      case 'payment_intent.payment_failed': {
        const intent = event.data.object as any
        logger.warn('Stripe payment failed', { event })
        // Rastro de auditoría del cobro fallido (append-only, vía el connector payment-requests-auditlog).
        await audit?.(webhookFailedEntry(hotelId, intent))
        break
      }
      default:
        break
    }
    return { received: true }
  } catch (e: any) {
    logger.error('Stripe webhook handler failed', e)
    return { status: 500, error: 'Internal error' } as any
  }
}

/** Stripe cotiza en la unidad mínima de la moneda (centavos). */
function amountOf(session: any, pr: PaymentRequestDTO): number {
  return Math.abs(Number(session.amount_total ?? pr.amount ?? 0)) / 100
}

async function findOpenFolio(folioRepo: RepositoryAdapter<any>, reservationId?: string): Promise<any | null> {
  if (!reservationId) return null
  const folios = await folioRepo.findMany({ reservationId })
  return folios.find((f: any) => f.status === 'open') ?? null
}

/** Bridge: aplicar el pago a la reserva (deposit/pendingAmount/status) + folio (cargo payment). */
async function applyPaymentBridge(
  reservationRepo: RepositoryAdapter<any>,
  folioChargeRepo: RepositoryAdapter<any>,
  pr: PaymentRequestDTO,
  session: any,
  openFolio: any | null,
): Promise<void> {
  const amountPaid = amountOf(session, pr)
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
