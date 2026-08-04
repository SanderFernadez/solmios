// shared/usecases/habitaciones-availability.ts — Anota disponibilidad por rango de fechas en el
// listado de habitaciones que consume el panel STAFF (`GET /api/habitaciones?checkIn&checkOut`).
//
// Causa raíz de #645/#648: el selector de habitación del wizard de reserva del staff
// (`ReservationWizardModal.vue`) armaba las opciones desde `GET /api/habitaciones` SIN fechas —
// ofrecía cuartos ocupados como si estuvieran libres, y el backend recién los rechazaba al
// guardar (409). Este usecase reusa el MISMO criterio de solapamiento que
// `reservas/usecases/availability.ts` (vía `shared/usecases/room-overlap.ts`) para que la UI y
// el backend NUNCA diverjan en qué es "disponible".
//
// Un connector (`connectors/habitaciones-reservas.ts`) inyecta el puerto `ReservationsListPort`
// en `HabitacionesService.setAvailabilityDeps()` — el módulo `habitaciones` nunca importa
// `reservas` directo (regla del framework).
import { overlapsRange } from './room-overlap'

const ROOM_RESERVATIONS_LIMIT = 100

export interface ReservationsListPort {
  list: (query: any, user: any) => Promise<{ data: any[] }>
}

export interface RoomAvailabilityResult {
  available: boolean
  unavailableReason?: string
}

/** Consulta las reservas activas del cuarto y determina si hay solapamiento con [checkIn, checkOut). */
export async function checkRoomAvailability(
  reservas: ReservationsListPort,
  user: { id: string; role: string; hotelId?: string },
  roomId: string,
  checkIn: string,
  checkOut: string,
): Promise<RoomAvailabilityResult> {
  const { data: reservations } = await reservas.list({ roomId, limit: ROOM_RESERVATIONS_LIMIT }, user)
  const conflict = reservations.find((r: any) => overlapsRange(r, checkIn, checkOut))
  if (!conflict) return { available: true }
  return { available: false, unavailableReason: `Ocupada del ${conflict.checkIn} al ${conflict.checkOut}` }
}

/**
 * Anota cada habitación con `available`/`unavailableReason` sin ocultar ninguna — el fix de
 * #648 pide deshabilitar (no ocultar), con el motivo visible, para que el staff entienda por
 * qué una habitación aparece bloqueada en vez de simplemente no verla.
 */
export async function annotateRoomsAvailability<T extends { id: string }>(
  reservas: ReservationsListPort,
  user: { id: string; role: string; hotelId?: string },
  rooms: T[],
  checkIn: string,
  checkOut: string,
): Promise<(T & RoomAvailabilityResult)[]> {
  return Promise.all(rooms.map(async (room) => {
    const result = await checkRoomAvailability(reservas, user, room.id, checkIn, checkOut)
    return { ...room, ...result }
  }))
}
