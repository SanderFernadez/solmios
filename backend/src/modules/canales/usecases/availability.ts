// canales/usecases/availability.ts — Cálculo de availability por room type
// Lógica PURA (sin DB, sin HTTP): filtra rooms/reservas/bloqueos de un room type y
// produce los rangos comprimidos listos para POST /availability de Channex.
// El service lee la DB y le pasa los arrays crudos; este usecase solo computa.
//
// El cómputo día-a-día se movió a `shared/utils/daily-availability.ts` porque el calendario
// público del motor de reservas (`bookingengine`) necesita exactamente la misma cuenta y los
// módulos no se importan entre sí. Acá se re-exporta para no tocar callers ni tests: el
// comportamiento de canales es idéntico (default `isBlockingStatus` = status !== 'cancelled').

export {
  MS_PER_DAY,
  AVAILABILITY_HORIZON_DAYS,
  computeAvailabilityRanges,
  buildAvailabilityRanges,
} from '../../../shared/utils/daily-availability'
export type { AvailabilityRange } from '../../../shared/utils/daily-availability'

import { buildAvailabilityRanges } from '../../../shared/utils/daily-availability'
import type { AvailabilityRange } from '../../../shared/utils/daily-availability'

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
