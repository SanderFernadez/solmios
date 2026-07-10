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
    return {
      ...task,
      roomNumber: room.number != null ? String(room.number) : '',
      // `floor` viene null en habitaciones viejas: 0 es un piso real, pero es
      // mejor que `null` rompiendo el parseo de la app.
      floor: typeof room.floor === 'number' ? room.floor : 0,
      roomType: room.type != null ? String(room.type) : '',
    }
  })
}
