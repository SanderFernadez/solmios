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
  guestRepo?: RepositoryAdapter<any>,
  groupRepo?: RepositoryAdapter<any>,
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
  //
  // Los tres guards son FAIL-CLOSED a propósito: si el caller no inyectó el repo, no se puede
  // verificar la pertenencia y entonces se RECHAZA. Antes eran `if (campo && repo)`, o sea
  // opt-in: bastaba con no pasar el repo para que el guard desapareciera sin ruido, y así fue
  // como el agujero de `guestId` sobrevivió al fix de `roomId`. Un control de seguridad que se
  // apaga solo cuando falta una dependencia no es un control.
  if (dto.roomId) {
    if (!roomRepo) throw new ConflictError('No se puede verificar a qué hotel pertenece la habitación')
    const room = await roomRepo.findOne({ id: dto.roomId })
    if (!room || room.hotelId !== existing.hotelId) throw new ConflictError('La habitación no pertenece a este hotel')
  }
  // MISMO agujero por otro campo: `guestId` también viaja en el update (validators/schema.ts) y
  // `createReservation` SÍ lo valida (crud.ts) — el update se lo había salteado. Explotado en QA:
  // un PUT con el `guestId` de otro hotel hacía que `detail.ts` devolviera la ficha ajena entera
  // (email, teléfono, documento, dirección, notas), y que el checkout le sumara estadías y gasto
  // al CRM del huésped de ese otro hotel (crm/service.ts confía en que el guestId ya es propio).
  if (dto.guestId) {
    if (!guestRepo) throw new ConflictError('No se puede verificar a qué hotel pertenece el huésped')
    const guest = await guestRepo.findOne({ id: dto.guestId })
    if (!guest || guest.hotelId !== existing.hotelId) throw new ConflictError('El huésped no pertenece a este hotel')
  }
  // `groupId` entra por el mismo camino y con el mismo riesgo (schema.ts lo acepta en el update).
  if (dto.groupId) {
    if (!groupRepo) throw new ConflictError('No se puede verificar a qué hotel pertenece el grupo')
    const group = await groupRepo.findOne({ id: dto.groupId })
    if (!group || group.hotelId !== existing.hotelId) throw new ConflictError('El grupo no pertenece a este hotel')
  }
  // Disponibilidad si cambia habitación o fechas.
  if (dto.roomId || dto.checkIn || dto.checkOut) {
    await assertRoomAvailable(repo, dto.roomId || existing.roomId, newCheckIn, newCheckOut, id)
  }
}
