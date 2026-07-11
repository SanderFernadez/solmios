// housekeeping/usecases/room-info.ts — La tarea sabe a qué habitación va.
//
// La tabla `housekeeping` guarda solo `roomId`. La app muestra "Hab. {roomNumber}"
// y "Piso {floor}", así que sin esto la camarera veía una lista de tarjetas que
// decían "Hab." y "Piso 0": no sabía a dónde ir.

import type { RepositoryAdapter } from 'arckode-framework'

/** Lo que la app necesita de la habitación para pintar una tarea. */
export interface RoomInfo {
  roomNumber: string
  floor: number
  roomType: string
}

/**
 * Agrega número, piso y tipo de habitación a cada tarea.
 *
 * Una sola consulta para todas las habitaciones del lote, no una por tarea.
 * Estos campos NO son columnas de `housekeeping`: se agregan al leer y jamás
 * se pasan a `create`/`update`, que el ORM descartaría en silencio.
 */
export async function withRoomInfo<T extends { roomId?: string }>(
  roomRepo: RepositoryAdapter<any> | undefined,
  tasks: T[],
): Promise<Array<T & Partial<RoomInfo>>> {
  if (!roomRepo || tasks.length === 0) return tasks

  const rooms = await roomRepo.findMany({}).catch(() => [])
  const byId = new Map<string, any>(rooms.map((r: any) => [String(r.id), r]))

  return tasks.map((task) => {
    const room = task.roomId ? byId.get(String(task.roomId)) : undefined
    if (!room) return task
    const number = room.number != null ? String(room.number) : ''
    return {
      ...task,
      roomNumber: number,
      // El piso sale ya calculado del endpoint: si la habitación no lo tiene
      // guardado (viene null en casi todas), se deriva del número —el primer
      // grupo de dígitos: 204→2, 103→1, 101→1—. Así la app no tiene que
      // adivinarlo y sale igual en web y móvil.
      floor: resolveFloor(room.floor, number),
      roomType: room.type != null ? String(room.type) : '',
    }
  })
}

/** Piso guardado si es válido; si no, derivado del número de habitación. */
function resolveFloor(stored: unknown, number: string): number {
  if (typeof stored === 'number' && stored > 0) return stored
  const digits = number.match(/\d+/)?.[0]
  const n = digits ? parseInt(digits, 10) : 0
  if (n >= 100) return Math.floor(n / 100)
  if (n >= 10) return Math.floor(n / 10)
  return n > 0 ? 1 : 0
}
