// reservas/usecases/availability.ts
// Verifica que una habitación esté libre en un rango de fechas (sin solapamiento con reservas activas).
// Extraído del service (estaba duplicado en create y update) para mantenerlo <200 líneas.

import type { RepositoryAdapter } from 'arckode-framework'
import { ConflictError } from 'arckode-framework'
import type { ReservasDTO } from '../types'

/**
 * Lanza ConflictError (HTTP 409) si existe solapamiento con otra reserva activa (excluye cancelled/no_show).
 * Es un conflicto de recurso (la habitación ya está ocupada), no un error de autenticación.
 * @param excludeId id de la propia reserva al actualizar (para no chocar consigo misma); undefined en create.
 */
export async function assertRoomAvailable(
  repo: RepositoryAdapter<ReservasDTO>,
  roomId: string,
  checkIn: string,
  checkOut: string,
  excludeId?: string,
): Promise<void> {
  const overlapping = await repo.findMany({ roomId } as any)
  const active = overlapping.filter((r: any) => r.status !== 'cancelled' && r.status !== 'no_show')
  const hasOverlap = active.some((r: any) =>
    r.id !== excludeId && r.checkIn < checkOut && r.checkOut > checkIn,
  )
  if (hasOverlap) {
    throw new ConflictError('Habitación no disponible en esas fechas')
  }
}
