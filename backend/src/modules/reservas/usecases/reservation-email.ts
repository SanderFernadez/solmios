// reservas/usecases/reservation-email.ts — Encolar email transaccional al crear reserva.
// Puramente funcional: recibe dependencias del dominio, sin HTTP ni ORM directo.
// Verifica tenacy: solo usa datos de entidades que pertenecen al hotel de la reserva.

import type { RepositoryAdapter, Logger } from 'arckode-framework'
import type { EmailService } from '../../../services/email-service'
import { resolveGuestLanguage } from '../../../services/guest-language'
import type { CreateReservasDTO } from '../types'

// Subtipos mínimos de entidades cross-module (evitan `any` sin acoplar a los módulos ajenos).
interface GuestSummary { id: string; hotelId?: string; name?: string; firstName?: string; email?: string; nationality?: string; language?: string }
interface RoomSummary { id: string; hotelId?: string; number?: string }
interface HotelSummary { id: string; name?: string; phone?: string }

interface ReservationEmailDeps {
  emailService: EmailService | null
  guestRepo: RepositoryAdapter<GuestSummary>
  roomRepo: RepositoryAdapter<RoomSummary>
  hotelRepo: RepositoryAdapter<HotelSummary>
  logger: Logger
}

/**
 * Encola el email de confirmación/pre-venta según `dto.communicateClient`.
 * No-op si no hay emailService, communicateClient, guestId o email del huésped,
 * o si el huésped/habitación no pertenece al hotel de la reserva (defensa IDOR).
 */
export async function enqueueReservationEmail(
  deps: ReservationEmailDeps,
  dto: CreateReservasDTO,
  item: { id: string; locator?: string },
): Promise<void> {
  const { emailService, guestRepo, roomRepo, hotelRepo, logger } = deps
  const type = dto.communicateClient
  // Solo 'email_confirmation' y 'email_presaless' disparan envío. Cualquier otro valor (incl. typos/sms/whatsapp) → no-op.
  if (!emailService || (type !== 'email_confirmation' && type !== 'email_presaless') || !dto.guestId) return

  const guest = await guestRepo.findById(dto.guestId)
  if (!guest?.email) return
  if (guest.hotelId && dto.hotelId && guest.hotelId !== dto.hotelId) return // tenacy

  const room = await roomRepo.findById(dto.roomId)
  if (room?.hotelId && dto.hotelId && room.hotelId !== dto.hotelId) return // tenacy

  const hotel = await hotelRepo.findById(dto.hotelId)
  const hotelName = hotel?.name || 'Hotel'

  // Variables de plantilla del spec 6.1.4 (las no disponibles aquí van vacías).
  const variables: Record<string, string | number> = {
    guest_name: guest.name || guest.firstName || 'Huésped',
    hotel_name: hotelName,
    checkin_date: dto.checkIn,
    checkout_date: dto.checkOut,
    room_number: room?.number ?? '',
    total_amount: dto.totalAmount ?? '',
    wifi_network: '',
    wifi_password: '',
    lock_code: '',
    hotel_phone: hotel?.phone ?? '',
    locator: item.locator ?? '',
  }

  const isConfirmation = type === 'email_confirmation'
  const event = isConfirmation ? 'reservation_confirmed' : 'reservation_presale'
  const language = resolveGuestLanguage(guest ?? {})

  await emailService.enqueueNotification({
    to: guest.email, hotelId: dto.hotelId, event, language, variables,
    relatedType: 'reservation', relatedId: item.id,
  })
  logger.info('Email encolado', { to: guest.email, type, event, language, reservationId: item.id })
}
