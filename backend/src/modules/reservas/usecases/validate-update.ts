// reservas/usecases/validate-update.ts — Validaciones de update de reserva.
// Extraído de service.update para mantener reservas/service.ts < 200 líneas (gate arckode: no God Object).
import { ConflictError } from 'arckode-framework'
import type { RepositoryAdapter } from 'arckode-framework'
import type { ReservasDTO, UpdateReservasDTO } from '../types'
import { assertRoomAvailable } from './availability'
import { assertValidTransition } from './state-machine'

/** Valida transición de estado + coherencia de fechas + disponibilidad al editar una reserva. */
export async function assertUpdateValidations(
  repo: RepositoryAdapter<ReservasDTO>,
  existing: ReservasDTO,
  dto: UpdateReservasDTO,
  currentUser: { role: string },
  id: string,
  roomRepo?: RepositoryAdapter<any>,
): Promise<void> {
  // Máquina de estados (super_admin puede forzar).
  if (dto.status && currentUser.role !== 'super_admin') {
    // checked_in/checked_out tienen efecto físico (folio, cuarto ocupado): SOLO se logran vía
    // POST /checkin y /checkout. Por el PUT genérico cambiaban el estado dejando el cuarto libre y
    // sin folio (desync + estadía sin cobrar).
    if (dto.status === 'checked_in' || dto.status === 'checked_out') {
      throw new ConflictError(`El estado "${dto.status}" se logra con POST /checkin o /checkout, no editando la reserva`)
    }
    assertValidTransition(existing.status, dto.status)
  }
  // Coherencia de fechas.
  const newCheckIn = dto.checkIn || existing.checkIn
  const newCheckOut = dto.checkOut || existing.checkOut
  if (newCheckIn >= newCheckOut) {
    throw new ConflictError('checkIn debe ser anterior a checkOut')
  }
  // IDOR #668: si el patch trae un roomId nuevo, tiene que pertenecer al MISMO hotel que la
  // reserva (existing.hotelId — no currentUser.hotelId, que es undefined para super_admin).
  // Sin esto, un hotel_admin podía mover su propia reserva a una habitación de OTRO hotel:
  // `updateReservation` nunca recibía `roomRepo` y `assertRoomAvailable` no hace ownership check,
  // solo mira solapamiento de fechas contra ese roomId. Mismo patrón que `createReservation`
  // (crud.ts) — se lee por `findOne({id})`, no se filtra que la room "existe en otro hotel".
  if (dto.roomId && roomRepo) {
    const room = await roomRepo.findOne({ id: dto.roomId })
    if (!room || room.hotelId !== existing.hotelId) throw new ConflictError('La habitación no pertenece a este hotel')
  }
  // Disponibilidad si cambia habitación o fechas.
  if (dto.roomId || dto.checkIn || dto.checkOut) {
    await assertRoomAvailable(repo, dto.roomId || existing.roomId, newCheckIn, newCheckOut, id)
  }
}
