// subscriptions/usecases/handle-stripe-event.ts — Webhook de la cuenta de PLATAFORMA.
//
// Distinto de payment-requests/usecases/stripe-webhook.ts: ese verifica con el secret
// POR HOTEL (`/api/stripe/webhook/:hotelId`, cobros a huéspedes). Este verifica con
// `STRIPE_WEBHOOK_SECRET_PLATFORM` (`/api/stripe/webhook/platform`, el hotel pagándole a
// la plataforma) — cuentas y secrets separados a propósito, no se pueden mezclar.
//
// `handleStripeEvent` queda separado de la verificación de firma para poder testearlo con
// payloads de Stripe.Event construidos a mano, sin tener que fabricar una firma HMAC válida.
import type Stripe from 'stripe'
import type { RepositoryAdapter, Logger } from 'arckode-framework'
import { StripeService } from '../../../services/stripe-service'

/** Stripe expresa los epochs en SEGUNDOS; `Date` los quiere en milisegundos. */
const MS_PER_SECOND = 1000

export interface HandleStripeEventDeps {
  subscriptionsRepo: RepositoryAdapter<any>
  logger: Logger
  /** Cliente Stripe ya resuelto (cuenta de plataforma) — usado para retrieve() de la subscription. */
  stripe: Stripe
}

/**
 * `Subscription.current_period_end` ya no es un campo de la Subscription: la API version
 * 2025-08-27 (la que usa StripeService, ver stripe-service.ts) lo movió a cada
 * SubscriptionItem — una suscripción puede tener ítems con períodos de facturación
 * distintos. Este proyecto vende un plan = un ítem, así que el primero alcanza.
 */
function currentPeriodEndOf(sub: Stripe.Subscription): string | undefined {
  const end = sub.items?.data?.[0]?.current_period_end
  return typeof end === 'number' ? new Date(end * MS_PER_SECOND).toISOString() : undefined
}

/**
 * Misma migración de API version: `Invoice.subscription` ya no existe — el vínculo vive en
 * `invoice.parent.subscription_details.subscription` cuando el parent es una suscripción.
 */
function subscriptionIdOfInvoice(invoice: Stripe.Invoice): string | undefined {
  const sub = invoice.parent?.subscription_details?.subscription
  if (!sub) return undefined
  return typeof sub === 'string' ? sub : sub.id
}

/** Procesa UN evento ya verificado. No lanza para eventos desconocidos: los ignora (200 OK). */
export async function handleStripeEvent(deps: HandleStripeEventDeps, event: Stripe.Event): Promise<void> {
  const { subscriptionsRepo, logger, stripe } = deps

  switch (event.type) {
    case 'checkout.session.completed': {
      const session = event.data.object as Stripe.Checkout.Session
      if (session.mode !== 'subscription') break // one-off payments no son de este módulo

      const hotelId = session.metadata?.hotelId
      if (!hotelId) {
        logger.warn('checkout.session.completed sin hotelId en metadata', { sessionId: session.id })
        break
      }
      const sub = (await subscriptionsRepo.findMany({ hotelId }))[0] as any
      if (!sub) {
        logger.warn(`checkout.session.completed: no hay Subscription local para el hotel ${hotelId}`)
        break
      }

      const patch: Record<string, any> = { status: 'active' }
      if (session.customer) {
        patch.stripeCustomerId = typeof session.customer === 'string' ? session.customer : session.customer.id
      }
      const stripeSubscriptionId = typeof session.subscription === 'string'
        ? session.subscription
        : session.subscription?.id
      if (stripeSubscriptionId) {
        patch.stripeSubscriptionId = stripeSubscriptionId
        try {
          const stripeSub = await stripe.subscriptions.retrieve(stripeSubscriptionId)
          const periodEnd = currentPeriodEndOf(stripeSub)
          if (periodEnd) patch.currentPeriodEnd = periodEnd
        } catch (e) {
          logger.warn('No se pudo leer current_period_end de la Subscription de Stripe', { error: (e as Error).message })
        }
      }

      await subscriptionsRepo.update(sub.id, patch)
      logger.info('Suscripción activada por checkout', { hotelId, stripeSubscriptionId })
      break
    }

    case 'invoice.paid': {
      const invoice = event.data.object as Stripe.Invoice
      const stripeSubscriptionId = subscriptionIdOfInvoice(invoice)
      if (!stripeSubscriptionId) break

      const sub = (await subscriptionsRepo.findMany({ stripeSubscriptionId }))[0] as any
      if (!sub) {
        logger.warn(`invoice.paid: no hay Subscription local para ${stripeSubscriptionId}`)
        break
      }

      const patch: Record<string, any> = { status: 'active' }
      try {
        const stripeSub = await stripe.subscriptions.retrieve(stripeSubscriptionId)
        const periodEnd = currentPeriodEndOf(stripeSub)
        if (periodEnd) patch.currentPeriodEnd = periodEnd
      } catch (e) {
        logger.warn('No se pudo leer current_period_end tras invoice.paid', { error: (e as Error).message })
      }
      await subscriptionsRepo.update(sub.id, patch)
      logger.info('Suscripción renovada', { stripeSubscriptionId })
      break
    }

    case 'invoice.payment_failed': {
      const invoice = event.data.object as Stripe.Invoice
      const stripeSubscriptionId = subscriptionIdOfInvoice(invoice)
      if (!stripeSubscriptionId) break

      const sub = (await subscriptionsRepo.findMany({ stripeSubscriptionId }))[0] as any
      if (!sub) {
        logger.warn(`invoice.payment_failed: no hay Subscription local para ${stripeSubscriptionId}`)
        break
      }
      await subscriptionsRepo.update(sub.id, { status: 'past_due' })
      logger.warn('Cobro de suscripción falló', { stripeSubscriptionId })
      break
    }

    case 'customer.subscription.deleted': {
      const stripeSub = event.data.object as Stripe.Subscription
      const sub = (await subscriptionsRepo.findMany({ stripeSubscriptionId: stripeSub.id }))[0] as any
      if (!sub) {
        logger.warn(`customer.subscription.deleted: no hay Subscription local para ${stripeSub.id}`)
        break
      }
      await subscriptionsRepo.update(sub.id, { status: 'canceled', canceledAt: new Date().toISOString() })
      logger.info('Suscripción cancelada', { stripeSubscriptionId: stripeSub.id })
      break
    }

    default:
      break // evento no manejado: se ignora, 200 OK igual (patrón estándar de webhooks)
  }
}

export interface WebhookErrorResult {
  status: number
  body: { error: string; detail?: string }
}

/** Verifica la firma contra el secret de PLATAFORMA y despacha el evento. */
export async function processSubscriptionWebhook(
  deps: Omit<HandleStripeEventDeps, 'stripe'>,
  rawBody: string | Buffer,
  signature: string,
): Promise<{ received: true } | WebhookErrorResult> {
  const { logger } = deps
  const secret = process.env.STRIPE_WEBHOOK_SECRET_PLATFORM
  if (!secret) return { status: 503, body: { error: 'Webhook de plataforma no configurado (falta STRIPE_WEBHOOK_SECRET_PLATFORM)' } }
  if (!signature) return { status: 400, body: { error: 'Falta stripe-signature' } }

  const stripe = await StripeService.getClient()
  if (!stripe) return { status: 503, body: { error: 'Stripe no está configurado en la plataforma' } }

  let event: Stripe.Event
  try {
    // `constructEventAsync`, NO `constructEvent`: bajo Bun el sincrónico lanza
    // "SubtleCryptoProvider cannot be used in a synchronous context" — mismo motivo que
    // payment-requests/usecases/stripe-webhook.ts.
    event = await stripe.webhooks.constructEventAsync(rawBody, signature, secret)
  } catch (e: any) {
    logger.warn('Stripe platform webhook signature failed', { error: e.message })
    return { status: 400, body: { error: 'Firma inválida', detail: e.message } }
  }

  try {
    await handleStripeEvent({ ...deps, stripe }, event)
    return { received: true }
  } catch (e: any) {
    logger.error('Stripe platform webhook handler failed', e)
    return { status: 500, body: { error: 'Internal error' } }
  }
}
