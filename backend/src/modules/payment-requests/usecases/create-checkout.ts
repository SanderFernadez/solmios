// payment-requests/usecases/create-checkout.ts — Genera la Checkout Session de Stripe para un
// PaymentRequest, asienta el link, audita, y (si el request lo pide) envía el link por email.
// Extraído del service para no pasar de 200 líneas (gate arckode).

import type { RepositoryAdapter, Logger } from 'arckode-framework'
import { StripeService } from '../../../services/stripe-service'
import type { EmailSender } from '../../../services/email-sender'
import { sendPaymentLinkEmail } from './payment-link-email'
import { checkoutSessionCreatedEntry, type AuditEntry } from './audit'
import type { PaymentRequestDTO, CheckoutResult, CurrentUser } from '../types'

const DEFAULT_PORT = 3000

export interface CreateCheckoutDeps {
  repo: RepositoryAdapter<PaymentRequestDTO>
  reservationRepo: RepositoryAdapter<any>
  userRepo: RepositoryAdapter<any>
  hotelRepoForEmail: RepositoryAdapter<any> | null
  emailSender: EmailSender | null
  audit: (entry: AuditEntry) => Promise<void>
  logger: Logger
}

/** El caller ya validó Stripe configurado, ownership y que no esté pagado. */
export async function createCheckoutForRequest(
  deps: CreateCheckoutDeps, pr: PaymentRequestDTO, id: string, hotelId: string, origin: string, user: CurrentUser,
): Promise<CheckoutResult | { status: number; body: any }> {
  const fallbackOrigin = `http://localhost:${process.env.PORT || DEFAULT_PORT}`
  const guestEmail = pr.sentTo?.includes('@') ? pr.sentTo : undefined
  try {
    const result = await StripeService.createCheckoutSession({
      hotelId, paymentRequestId: id, amount: Number(pr.amount), currency: pr.currency || 'usd',
      description: `Reserva ${String(pr.reservationId || '').slice(0, 8)}`,
      successUrl: `${origin || fallbackOrigin}/panel/finanzas/links-pago?status=paid&id=${id}`,
      cancelUrl: `${origin || fallbackOrigin}/panel/finanzas/links-pago?status=cancelled&id=${id}`,
      customerEmail: guestEmail, metadata: { hotelId: pr.hotelId, reservationId: pr.reservationId || '' },
    })
    await deps.repo.update(id, { stripeSessionId: result.sessionId, stripePaymentUrl: result.sessionUrl } as Partial<PaymentRequestDTO>)
    await deps.audit(checkoutSessionCreatedEntry(pr, result.sessionId, user))
    // Link por email si el request lo pide (sentVia='email') y es la 1ª generación (no re-spamear al
    // regenerar). Fire-and-forget: un fallo de correo no tumba la creación del checkout.
    if (deps.emailSender && deps.hotelRepoForEmail && !pr.stripePaymentUrl) {
      sendPaymentLinkEmail(
        { emailSender: deps.emailSender, hotelRepo: deps.hotelRepoForEmail, reservationRepo: deps.reservationRepo, guestRepo: deps.userRepo, logger: deps.logger },
        pr, result.sessionUrl,
      ).catch((e) => deps.logger.warn('payment-link email', { error: (e as Error).message }))
    }
    return { url: result.sessionUrl, sessionId: result.sessionId }
  } catch (e: any) {
    deps.logger.error('Stripe create checkout failed', e)
    return { status: 500, body: { error: 'Error al crear sesión de pago', detail: e.message } }
  }
}
