// reservas/usecases/lifecycle-email.ts — Emails del ciclo de vida: no_show y checkout (D3).
//
// Cierra el dispatcher de auto-messages: cada evento del ciclo de vida de la reserva envía
// su email configurable (override del hotel en auto_messages > default de código). Los eventos
// reservation_confirmed/presale (create) y checkin_welcome (check-in) ya tienen su handler;
// este cubre no_show (markNoShows) y checkout (endpoint checkout).
//
// Patrón idéntico a checkin-email.ts pero paramétrico en `event`. Reutiliza NotificationRenderer
// vía emailSender.enqueueNotification. Fire-and-forget: registra en message_logs (sent/failed/skipped).
//
// Canal WhatsApp (campo channel='whatsapp'/'both' en auto_messages) queda como deuda (D2):
// hoy solo email; cuando exista WhatsAppProvider, el dispatcher ruteará por canal.

import type { RepositoryAdapter, Logger } from 'arckode-framework'
import type { EmailSender } from '../../../services/email-sender'
import { resolveGuestLanguage } from '../../../services/guest-language'
import type { GuestSummary, RoomSummary, HotelSummary, MessageLogSummary } from './types'

interface LifecycleEmailDeps {
  emailSender: EmailSender
  guestRepo: RepositoryAdapter<GuestSummary>
  roomRepo: RepositoryAdapter<RoomSummary>
  hotelRepo: RepositoryAdapter<HotelSummary>
  messageLogRepo: RepositoryAdapter<MessageLogSummary>
  logger: Logger
}

interface LifecycleEmailInput {
  reservationId: string
  hotelId: string
  guestId: string | null | undefined
  roomId: string | null | undefined
  checkIn: string
  checkOut: string
  event: 'no_show' | 'checkout'
}

/**
 * Dispara el email de un evento del ciclo de vida (no_show | checkout). No-op seguro si faltan deps.
 * - Sin guestId o sin email → log 'skipped', no encola.
 * - Tenacy: si guest/room no pertenecen al hotel de la reserva, aborta.
 * Registra cada intento en message_logs.
 */
export async function dispatchLifecycleEmail(deps: LifecycleEmailDeps, input: LifecycleEmailInput): Promise<void> {
  const { emailSender, guestRepo, roomRepo, hotelRepo, messageLogRepo, logger } = deps
  if (!input.guestId) {
    logger.info('lifecycle-email: sin guestId', { reservationId: input.reservationId, event: input.event })
    return
  }

  const guest = await guestRepo.findById(input.guestId)
  if (guest?.hotelId && guest.hotelId !== input.hotelId) return // tenacy
  const room = input.roomId ? await roomRepo.findById(input.roomId) : null
  if (room?.hotelId && room.hotelId !== input.hotelId) return // tenacy
  const hotel = await hotelRepo.findById(input.hotelId)

  const guestName = guest?.name || guest?.firstName || 'Huésped'
  const language = resolveGuestLanguage(guest ?? {})

  if (!guest?.email) {
    await messageLogRepo.create({
      hotelId: input.hotelId, reservationId: input.reservationId, messageId: null,
      messageType: 'email', response: `sin email, no se envió (${input.event})`,
      status: 'skipped', recipient: null, sentAt: null,
    } as Omit<MessageLogSummary, 'id'>)
    return
  }

  const variables: Record<string, string | number> = {
    guest_name: guestName,
    hotel_name: hotel?.name || 'Hotel',
    hotel_phone: hotel?.phone ?? '',
    room_number: room?.number ?? '',
    checkin_date: input.checkIn,
    checkout_date: input.checkOut,
  }

  try {
    const queueId = await emailSender.enqueueNotification({
      to: guest.email, hotelId: input.hotelId, event: input.event, language, variables,
      relatedType: input.event, relatedId: input.reservationId,
    })
    await messageLogRepo.create({
      hotelId: input.hotelId, reservationId: input.reservationId, messageId: queueId || null,
      messageType: 'email', response: `notification:${input.event} [${language}]`,
      status: 'sent', recipient: guest.email, sentAt: new Date().toISOString(),
    } as Omit<MessageLogSummary, 'id'>)
    logger.info('lifecycle-email: encolado', { reservationId: input.reservationId, event: input.event, to: guest.email, queueId })
  } catch (e) {
    await messageLogRepo.create({
      hotelId: input.hotelId, reservationId: input.reservationId, messageId: null,
      messageType: 'email', response: (e as Error).message,
      status: 'failed', recipient: guest.email, sentAt: null,
    } as Omit<MessageLogSummary, 'id'>)
    logger.warn('lifecycle-email: fallo al encolar', { reservationId: input.reservationId, event: input.event, error: (e as Error).message })
  }
}
