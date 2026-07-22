// opiniones/usecases/review-invite-email.ts — Email de invitación a dejar una reseña tras el checkout.
// Manda un link público /resena/:token para que el huésped responda sin login. Best-effort.

import type { RepositoryAdapter, Logger } from 'arckode-framework'
import type { EmailSender } from '../../../services/email-sender'
import { resolveGuestLanguage } from '../../../services/guest-language'

export interface ReviewInviteEmailDeps {
  emailSender: EmailSender
  guestRepo: RepositoryAdapter<{ id: string; email?: string; name?: string; firstName?: string }>
  hotelRepo: RepositoryAdapter<{ id: string; name?: string }>
  publicUrl: string
  logger: Logger
}

export async function sendReviewInviteEmail(
  deps: ReviewInviteEmailDeps,
  invite: { hotelId: string; guestId?: string | null; token?: string },
): Promise<void> {
  if (!invite.token || !invite.guestId || !deps.publicUrl) return
  const guest = await deps.guestRepo.findById(invite.guestId).catch(() => null)
  if (!guest?.email) return // sin email no hay a quién invitar (walk-in / OTA sin contacto)

  const hotel = await deps.hotelRepo.findById(invite.hotelId).catch(() => null)
  const reviewUrl = `${deps.publicUrl.replace(/\/$/, '')}/resena/${invite.token}`
  await deps.emailSender.enqueueNotification({
    to: guest.email, hotelId: invite.hotelId, event: 'review_request', language: resolveGuestLanguage(guest as Record<string, unknown>),
    variables: { hotel_name: hotel?.name ?? '', guest_name: guest.name || guest.firstName || 'Huésped', review_url: reviewUrl },
    relatedType: 'review', relatedId: invite.token,
  })
  deps.logger.info('review-invite email encolado', { hotelId: invite.hotelId, to: guest.email })
}
