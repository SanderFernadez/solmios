// reservas/usecases/checkin-email.ts — Email de bienvenida al hacer check-in (spec 11.1.1).
//
// Puramente funcional: recibe dependencias del dominio, sin HTTP ni ORM directo.
// Disparado desde el endpoint /api/reservas/:id/checkin Y desde service.update al
// pasar a status='checked_in' (dual path: el frontend hace check-in vía update).
// Si el huésped no tiene email (walk-in), no envía y lo registra como 'skipped'.
//
// message_logs usa el modelo del módulo marketing: messageType/status/recipient/response/sentAt.

import type { RepositoryAdapter, Logger } from 'arckode-framework'
import { checkinWelcome } from '../../../services/email-service'
import type { EmailService } from '../../../services/email-service'

// Subtipos mínimos de entidades cross-module (evitan `any` sin acoplar a módulos ajenos).
interface GuestSummary { id: string; hotelId?: string; name?: string; firstName?: string; email?: string }
interface RoomSummary { id: string; hotelId?: string; number?: string }
interface HotelSummary { id: string; name?: string; address?: string; phone?: string }
/** Subtipo del log de mensajes (modelo MessageLogs del módulo marketing). */
interface MessageLogSummary {
  id: string
  hotelId: string
  reservationId?: string | null
  messageId?: string | null
  messageType: string
  status?: string | null
  recipient?: string | null
  response?: string | null
  sentAt?: string | null
}

interface CheckinEmailDeps {
  emailService: EmailService | null
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
  const { emailService, guestRepo, roomRepo, hotelRepo, messageLogRepo, logger } = deps
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
  const hotelName = hotel?.name || 'Hotel'
  const subject = `¡Bienvenido a ${hotelName}, ${guestName}!`

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
    hotel_name: hotelName,
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
  const html = checkinWelcome(variables)

  try {
    if (emailService) {
      await emailService.enqueue({
        to: guest.email, subject, html, hotelId: input.hotelId,
        relatedType: 'checkin', relatedId: input.reservationId,
      })
    }
    await messageLogRepo.create({
      hotelId: input.hotelId, reservationId: input.reservationId, messageId: null,
      messageType: 'email', response: subject,
      status: 'sent', recipient: guest.email, sentAt: new Date().toISOString(),
    } as Omit<MessageLogSummary, 'id'>)
    logger.info('checkin-email: enviado', { reservationId: input.reservationId, to: guest.email })
  } catch (e) {
    await messageLogRepo.create({
      hotelId: input.hotelId, reservationId: input.reservationId, messageId: null,
      messageType: 'email', response: (e as Error).message,
      status: 'failed', recipient: guest.email, sentAt: null,
    } as Omit<MessageLogSummary, 'id'>)
    logger.warn('checkin-email: fallo al encolar', { reservationId: input.reservationId, error: (e as Error).message })
  }
}
