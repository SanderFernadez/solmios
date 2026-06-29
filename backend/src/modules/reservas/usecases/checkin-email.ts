// reservas/usecases/checkin-email.ts — Email de bienvenida al hacer check-in (spec 11.1.1).
//
// Puramente funcional: recibe dependencias del dominio, sin HTTP ni ORM directo.
// Disparado desde el endpoint /api/reservas/:id/checkin Y desde service.update al
// pasar a status='checked_in' (dual path: el frontend hace check-in vía update).
// Si el huésped no tiene email (walk-in), no envía y lo registra como 'skipped'.
//
// message_logs usa el modelo del módulo marketing: messageType/status/recipient/response/sentAt.

import type { RepositoryAdapter, Logger } from 'arckode-framework'
import type { EmailSender } from '../../../services/email-sender'
import { resolveGuestLanguage } from '../../../services/guest-language'
import type { GuestSummary, RoomSummary, HotelSummary, MessageLogSummary } from './types'

interface CheckinEmailDeps {
  emailSender: EmailSender
  guestRepo: RepositoryAdapter<GuestSummary>
  roomRepo: RepositoryAdapter<RoomSummary>
  hotelRepo: RepositoryAdapter<HotelSummary>
  messageLogRepo: RepositoryAdapter<MessageLogSummary>
  logger: Logger
}

interface CheckinEmailInput {
  reservationId: string
  hotelId: string
  guestId: string | null | undefined
  roomId: string | null | undefined
  checkIn: string
  checkOut: string
}

/**
 * Dispara el email de bienvenida al check-in. No-op seguro si faltan dependencias.
 * - Huésped sin email → log 'skipped' (walk-in), no encola.
 * - Tenacy: si guest/room no pertenecen al hotel de la reserva, aborta (defensa IDOR).
 * Registra cada intento en message_logs (status sent/failed/skipped, spec 11.1.1).
 */
export async function sendCheckinEmail(deps: CheckinEmailDeps, input: CheckinEmailInput): Promise<void> {
  const { emailSender, guestRepo, roomRepo, hotelRepo, messageLogRepo, logger } = deps
  if (!input.guestId) {
    logger.info('checkin-email: sin guestId', { reservationId: input.reservationId })
    return
  }

  const guest = await guestRepo.findById(input.guestId)
  if (guest?.hotelId && guest.hotelId !== input.hotelId) return // tenacy
  const room = input.roomId ? await roomRepo.findById(input.roomId) : null
  if (room?.hotelId && room.hotelId !== input.hotelId) return // tenacy
  const hotel = await hotelRepo.findById(input.hotelId)

  const guestName = guest?.name || guest?.firstName || 'Huésped'
  const language = resolveGuestLanguage(guest ?? {})

  // Walk-in sin email: no se envía, se loggea (spec 11.1.1).
  if (!guest?.email) {
    await messageLogRepo.create({
      hotelId: input.hotelId, reservationId: input.reservationId, messageId: null,
      messageType: 'email', response: `walk-in sin email, no se envió notificación (${guestName})`,
      status: 'skipped', recipient: null, sentAt: null,
    } as Omit<MessageLogSummary, 'id'>)
    logger.info('checkin-email: walk-in sin email', { reservationId: input.reservationId, guestId: input.guestId })
    return
  }

  // Variables de plantilla 11.1.1. wifi/lock_code/pre_checkin dependen de config/integraciones
  // no implementadas aún (ver tasks 11.1.4 wifi_config, 11.1.5 branding, F5 TTLock, F8 pre-checkin).
  const variables: Record<string, string | number> = {
    guest_name: guestName,
    hotel_name: hotel?.name || 'Hotel',
    hotel_address: hotel?.address ?? '',
    hotel_phone: hotel?.phone ?? '',
    room_number: room?.number ?? '',
    checkin_date: input.checkIn,
    checkout_date: input.checkOut,
    wifi_network: '',
    wifi_password: '',
    lock_code: '',
    pre_checkin_url: '',
  }

  try {
    const queueId = await emailSender.enqueueNotification({
      to: guest.email, hotelId: input.hotelId, event: 'checkin_welcome', language, variables,
      relatedType: 'checkin', relatedId: input.reservationId,
    })
    // Trazabilidad: response = identificador del evento×idioma (no el subject crudo con placeholders — fix H3).
    await messageLogRepo.create({
      hotelId: input.hotelId, reservationId: input.reservationId, messageId: queueId || null,
      messageType: 'email', response: `notification:checkin_welcome [${language}]`,
      status: 'sent', recipient: guest.email, sentAt: new Date().toISOString(),
    } as Omit<MessageLogSummary, 'id'>)
    logger.info('checkin-email: encolado', { reservationId: input.reservationId, to: guest.email, queueId })
  } catch (e) {
    await messageLogRepo.create({
      hotelId: input.hotelId, reservationId: input.reservationId, messageId: null,
      messageType: 'email', response: (e as Error).message,
      status: 'failed', recipient: guest.email, sentAt: null,
    } as Omit<MessageLogSummary, 'id'>)
    logger.warn('checkin-email: fallo al encolar', { reservationId: input.reservationId, error: (e as Error).message })
  }
}
