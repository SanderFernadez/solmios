// canales/usecases/availability.ts — Cálculo de availability por room type
// Lógica PURA (sin DB, sin HTTP): filtra rooms/reservas/bloqueos de un room type y
// produce los rangos comprimidos listos para POST /availability de Channex.
// El service lee la DB y le pasa los arrays crudos; este usecase solo computa.

export const MS_PER_DAY = 86_400_000
// Horizonte del push de availability: hoy → +N días. Suficiente para OTAs sin agotar la API.
export const AVAILABILITY_HORIZON_DAYS = 90

export interface AvailabilityRange {
  dateFrom: string
  dateTo: string
  availability: number
}

/**
 * availability[día] = count − ocupadas, clampeado a 0 (overbook → 0).
 * Ocupación por día D:
 *  - Reserva: checkIn <= D < checkOut (checkout day queda libre — turnover) y status !== 'cancelled'.
 *  - Bloqueo: startDate <= D <= endDate (inclusivo — bloquea las noches de inicio a fin).
 * Rangos consecutivos de igual valor se comprimen (run-length encoding).
 */
export function computeAvailabilityRanges(
  start: string,
  end: string,
  count: number,
  reservations: { checkIn: string; checkOut: string }[],
  blocks: { startDate: string; endDate: string }[],
): AvailabilityRange[] {
  const days: string[] = []
  for (let t = new Date(start).getTime(); t < new Date(end).getTime(); t += MS_PER_DAY) {
    days.push(new Date(t).toISOString().slice(0, 10))
  }
  const perDay = days.map(d => {
    let occupied = 0
    for (const r of reservations) if (r.checkIn <= d && r.checkOut > d) occupied++
    for (const b of blocks) if (b.startDate <= d && b.endDate >= d) occupied++
    return { date: d, availability: Math.max(0, count - occupied) }
  })
  const ranges: AvailabilityRange[] = []
  for (const a of perDay) {
    const last = ranges[ranges.length - 1]
    if (last && last.availability === a.availability) last.dateTo = a.date
    else ranges.push({ dateFrom: a.date, dateTo: a.date, availability: a.availability })
  }
  return ranges
}

/**
 * Filtra rooms/reservas/bloqueos del roomType indicado y devuelve los rangos de availability
 * para hoy → +90 días. Devuelve null si el hotel no tiene rooms de ese tipo (nada que empujar).
 */
export function buildAvailabilityRanges(
  roomType: string,
  rooms: { id: string; type: string }[],
  reservations: { roomId: string; status: string; checkIn: string; checkOut: string }[],
  blocks: { roomId: string; startDate: string; endDate: string }[],
): AvailabilityRange[] | null {
  const want = String(roomType).toLowerCase()
  const typeRooms = rooms.filter(r => String(r.type).toLowerCase() === want)
  if (typeRooms.length === 0) return null
  const typeRoomIds = new Set(typeRooms.map(r => r.id))

  const today = new Date().toISOString().split('T')[0]
  const end = new Date(Date.now() + AVAILABILITY_HORIZON_DAYS * MS_PER_DAY).toISOString().split('T')[0]

  const relRes = reservations.filter(r =>
    typeRoomIds.has(r.roomId) && r.status !== 'cancelled' && r.checkIn && r.checkOut && r.checkIn < end && r.checkOut > today)
  const relBlocks = blocks.filter(b =>
    typeRoomIds.has(b.roomId) && b.startDate && b.endDate && b.startDate <= end && b.endDate >= today)

  return computeAvailabilityRanges(today, end, typeRooms.length, relRes, relBlocks)
}

/** Dependencias que el service inyecta al usecase (ORM + config + push a Channex). */
export interface AvailabilityDeps {
  findMany: (model: string, query: any) => Promise<any[]>
  getConfig: (hotelId: string) => Promise<{ channexPropertyId?: string | null } | undefined>
  pushToChannex: (cfg: any, roomType: string, ranges: AvailabilityRange[]) => Promise<{ pushed: boolean }>
}

/** Lee DB del hotel, recalcula availability del roomType y empuja a Channex. */
export async function pushAvailabilityForRoomType(deps: AvailabilityDeps, hotelId: string, roomType: string): Promise<{ pushed: boolean }> {
  const cfg = await deps.getConfig(hotelId)
  if (!cfg?.channexPropertyId) return { pushed: false }
  const [rooms, reservations, blocks] = await Promise.all([
    deps.findMany('Rooms', { hotelId }),
    deps.findMany('Reservations', { hotelId }),
    deps.findMany('RoomBlocks', { hotelId }),
  ])
  const ranges = buildAvailabilityRanges(roomType, rooms, reservations, blocks)
  if (!ranges?.length) return { pushed: false }
  return deps.pushToChannex(cfg, roomType, ranges)
}

/** Atajo: resuelve el roomType desde roomId y empuja availability de ese tipo. */
export async function pushAvailabilityForRoom(deps: AvailabilityDeps, hotelId: string, roomId: string): Promise<{ pushed: boolean }> {
  const room = (await deps.findMany('Rooms', { id: roomId }))[0]
  if (!room) return { pushed: false }
  return pushAvailabilityForRoomType(deps, hotelId, room.type)
}
