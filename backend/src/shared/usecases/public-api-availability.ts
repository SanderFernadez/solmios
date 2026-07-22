// shared/usecases/public-api-availability.ts — Lógica de disponibilidad para la API pública v1.
// Extraído del connector `publicapi-reservas.ts` (los conectores SOLO deben wirear — CLAUDE #3,
// `arckode analyze` bloquea lógica de negocio en connectors/). Mismo criterio que
// `notify-task-assigned.ts`: usecase puro en shared/, consumido por un connector.

import type { PublicRoomAvailabilityDTO, PublicRoomsQuery } from '../../modules/publicapi/types'

const ROOM_LIST_LIMIT = 100

export interface RoomsListPort { list: (query: any, user: any) => Promise<{ data: any[] }> }
export interface ReservasListPort { list: (query: any, user: any) => Promise<{ data: any[] }> }

export function publicApiSystemUser(hotelId: string) {
  return { id: 'public-api-key', role: 'hotel_admin', hotelId }
}

function overlapsRange(r: { checkIn: string; checkOut: string; status?: string }, checkIn: string, checkOut: string): boolean {
  if (r.status === 'cancelled' || r.status === 'no_show') return false
  return r.checkIn < checkOut && r.checkOut > checkIn
}

async function roomAvailability(reservas: ReservasListPort, user: any, room: any, query: PublicRoomsQuery): Promise<boolean> {
  if (!query.checkIn || !query.checkOut) return room.status === 'available'
  const blockedStatus = room.status === 'out_of_order' || room.status === 'maintenance'
  if (blockedStatus) return false
  // Por-cuarto para no depender del tope de paginación de reservas a nivel hotel (MAX_LIMIT=100
  // en reservas/usecases/crud.ts) — un cuarto puntual sí entra holgado.
  const { data: reservations } = await reservas.list({ roomId: room.id, limit: ROOM_LIST_LIMIT }, user)
  const busy = reservations.some((r: any) => overlapsRange(r, query.checkIn as string, query.checkOut as string))
  return !busy
}

export async function listPublicRoomsAvailability(
  habitaciones: RoomsListPort,
  reservas: ReservasListPort,
  hotelId: string,
  query: PublicRoomsQuery,
): Promise<PublicRoomAvailabilityDTO[]> {
  const user = publicApiSystemUser(hotelId)
  const { data: rooms } = await habitaciones.list({ limit: ROOM_LIST_LIMIT }, user)

  return Promise.all(rooms.map(async (room: any) => ({
    id: room.id,
    number: room.number,
    name: room.name,
    type: room.type,
    basePrice: room.basePrice,
    capacity: room.capacity,
    available: await roomAvailability(reservas, user, room, query),
  })))
}
