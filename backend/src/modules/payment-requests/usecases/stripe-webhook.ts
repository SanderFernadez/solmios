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
              await applyPaymentBridge(reservationRepo, folioChargeRepo, pr, session, openFolio, logger)
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

/**
 * Tolerancia de centavos al comparar un pago contra el saldo (errores de redondeo float).
 * DEBE ser idéntico al `BALANCE_EPSILON` de `folios/usecases/folio-entries.ts`: el webhook no puede
 * importar cross-módulo, así que se duplica a propósito. Si los dos se divorcian, un pago aceptado
 * por el panel puede ser rechazado por el webhook (o viceversa) por un centavo.
 */
const BALANCE_EPSILON = 0.01

/**
 * Suma las líneas del folio y devuelve el saldo pendiente. Espejo de `folio-math.computeTotals`
 * (no se puede importar cross-módulo). Los pagos tienen `total` negativo, por eso se suman sus
 * valores absolutos.
 */
function computeFolioBalance(charges: any[]): number {
  const round2 = (n: number) => Math.round((n + Number.EPSILON) * 100) / 100
  const cargos = charges.filter((c) => c.kind === 'charge')
  const pagos = charges.filter((c) => c.kind === 'payment')
  const chargesTotal = round2(cargos.reduce((s, c) => s + Number(c.total || 0), 0))
  const paymentsTotal = round2(pagos.reduce((s, c) => s + Math.abs(Number(c.total || 0)), 0))
  return round2(chargesTotal - paymentsTotal)
}

/**
 * Bridge: aplicar el pago a la reserva (deposit/pendingAmount/status) + folio (cargo payment).
 *
 * GUARDIÁN DE SALDO: antes de escribir el cargo `kind:'payment'` en el folio, verifica que el monto
 * no exceda el saldo pendiente. El Checkout de Stripe fija el monto al crear la sesión, pero al
 * llegar el webhook el folio puede tener pagos parciales previos (efectivo, transferencia) → el
 * cargo directo dejaba el folio en negativo. NO se puede rutear por `FoliosService.applyPayment`
 * porque (a) duplica el asiento en `payments` (el webhook ya lo hizo vía `recordStripePayment`) y
 * (b) exige un `CurrentUser` que no existe en un endpoint público firmado por Stripe. El guardián
 * se aplica entonces inline, con el mismo `BALANCE_EPSILON` y la misma matemática de
 * `folio-entries.ts`. Si el pago excede el saldo, se omite el cargo foliar y se loguea para que un
 * humano reconcilie; la reserva igual recibe el depósito (tiene su propio `Math.max(0,…)` contra
 * saldo negativo) y el `payments` ya quedó asentado.
 */
async function applyPaymentBridge(
  reservationRepo: RepositoryAdapter<any>,
  folioChargeRepo: RepositoryAdapter<any>,
  pr: PaymentRequestDTO,
  session: any,
  openFolio: any | null,
  logger: Logger,
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
    // Guardián de saldo: espejo de folios/usecases/folio-entries.ts:77-79.
    const charges = await folioChargeRepo.findMany({ folioId: openFolio.id })
    const balance = computeFolioBalance(charges as any[])
    if (amountPaid > balance + BALANCE_EPSILON) {
      logger.warn(
        'Stripe webhook: el cobro excede el saldo del folio, se omite el cargo para no dejarlo negativo',
        {
          folioId: openFolio.id, paymentRequestId: pr.id,
          amountPaid, balance, stripeSessionId: session.id,
        },
      )
      return
    }
    await folioChargeRepo.create({
      folioId: openFolio.id, hotelId,
      description: `Pago Stripe · Ref ${session.payment_intent || session.id}`,
      category: 'payment', kind: 'payment', quantity: 1,
      amount: -amountPaid, taxes: 0, total: -amountPaid, source: 'stripe',
      postedAt: new Date().toISOString(),
    } as any)
  }
}
