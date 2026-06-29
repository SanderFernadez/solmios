// reservas/usecases/reservation-notifications.ts — Dispatch de emails transaccionales de reserva.
// Extrae los side-effects de email del service para mantenerlo <200 líneas (gate arckode: no God Object).
// Envuelve los usecases de dominio (reservation-email, checkin-email) ensamblando las dependencias.

import type { RepositoryAdapter, Logger } from 'arckode-framework'
import type { EmailSender } from '../../../services/email-sender'
import { enqueueReservationEmail } from './reservation-email'
import { sendCheckinEmail } from './checkin-email'
import type { CreateReservasDTO, UpdateReservasDTO, ReservasDTO } from '../types'
import type { GuestSummary, RoomSummary, HotelSummary, MessageLogSummary } from './types'

export interface NotifyDeps {
  emailSender: EmailSender
  messageLogRepo: RepositoryAdapter<MessageLogSummary> | null
  guestRepo: RepositoryAdapter<GuestSummary>
  roomRepo: RepositoryAdapter<RoomSummary>
  hotelRepo: RepositoryAdapter<HotelSummary>
  logger: Logger
}

/** Email de confirmación/pre-venta al crear reserva (spec 6.1.4). Fire-and-forget. */
export function dispatchCreateEmail(deps: NotifyDeps, dto: CreateReservasDTO, item: ReservasDTO): void {
  enqueueReservationEmail(
    { emailSender: deps.emailSender, guestRepo: deps.guestRepo, roomRepo: deps.roomRepo, hotelRepo: deps.hotelRepo, logger: deps.logger },
    dto, item,
  ).catch((e) => deps.logger.warn('Error encolando email de reserva', { error: (e as Error).message }))
}

/** Email de bienvenida al pasar a status checked_in (spec 11.1.1, dual path). Fire-and-forget. */
export function dispatchCheckinEmail(deps: NotifyDeps, existing: ReservasDTO, dto: UpdateReservasDTO, item: ReservasDTO): void {
  if (existing.status !== 'checked_in' && dto.status === 'checked_in' && deps.messageLogRepo) {
    sendCheckinEmail(
      { emailSender: deps.emailSender, guestRepo: deps.guestRepo, roomRepo: deps.roomRepo, hotelRepo: deps.hotelRepo, messageLogRepo: deps.messageLogRepo, logger: deps.logger },
      { reservationId: item.id, hotelId: item.hotelId, guestId: item.guestId, roomId: item.roomId, checkIn: item.checkIn, checkOut: item.checkOut },
    ).catch((e) => deps.logger.warn('Error en email de check-in', { error: (e as Error).message }))
  }
}
