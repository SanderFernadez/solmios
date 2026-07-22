// payment-requests/usecases/payment-link-email.ts — Envía el link de pago (Stripe) por email.
// Se dispara al generar el checkout SI el request pide entrega por email (sentVia='email') y tiene
// un destinatario válido. Antes el link se generaba pero nunca llegaba al huésped por correo.

import type { RepositoryAdapter, Logger } from 'arckode-framework'
import type { EmailSender } from '../../../services/email-sender'
import { resolveGuestLanguage } from '../../../services/guest-language'
import type { PaymentRequestDTO } from '../types'

export interface PaymentLinkEmailDeps {
  emailSender: EmailSender
  hotelRepo: RepositoryAdapter<{ id: string; name?: string }>
  reservationRepo: RepositoryAdapter<{ id: string; guestId?: string | null }>
  guestRepo: RepositoryAdapter<Record<string, unknown>>
  logger: Logger
}

export async function sendPaymentLinkEmail(deps: PaymentLinkEmailDeps, pr: PaymentRequestDTO, paymentUrl: string): Promise<void> {
  if (pr.sentVia !== 'email') return
  const to = pr.sentTo && pr.sentTo.includes('@') ? pr.sentTo : ''
  if (!to || !paymentUrl) return

  const hotel = await deps.hotelRepo.findById(pr.hotelId).catch(() => null)
  // Idioma del huésped si se puede resolver desde la reserva; si no, español (fallback del template).
  let language = resolveGuestLanguage({})
  if (pr.reservationId) {
    const res = await deps.reservationRepo.findById(pr.reservationId).catch(() => null)
    const guest = res?.guestId ? await deps.guestRepo.findById(res.guestId).catch(() => null) : null
    if (guest) language = resolveGuestLanguage(guest)
  }

  await deps.emailSender.enqueueNotification({
    to, hotelId: pr.hotelId, event: 'payment_link', language,
    variables: { hotel_name: hotel?.name ?? '', amount: pr.amount, currency: pr.currency || 'USD', payment_url: paymentUrl },
    relatedType: 'payment_request', relatedId: pr.id,
  })
  deps.logger.info('payment-link email encolado', { paymentRequestId: pr.id, to })
}
