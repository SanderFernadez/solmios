// mantenimiento/helpers.ts — Funciones compartidas del módulo
import { AuthError, NotFoundError } from 'arckode-framework'
import type { RepositoryAdapter } from 'arckode-framework'

/**
 * El ticket, verificando que sea del hotel de quien lo pide. Todo camino que
 * toque un ticket por id pasa por acá: sin esto se podría leer o editar el
 * ticket de otro hotel adivinando el id (IDOR).
 */
export async function findOwnedTicket<T extends { hotelId: string }>(
  repo: RepositoryAdapter<T>,
  id: string,
  currentUser: { id: string; role: string; hotelId?: string },
): Promise<T> {
  const item = await repo.findById(id)
  if (!item) throw new NotFoundError('Ticket de mantenimiento no encontrado')
  assertOwnership(item.hotelId, currentUser)
  return item
}

/** Verifica que el usuario tenga acceso al hotel del recurso. Lanza AuthError si no. */
export function assertOwnership(
  resourceHotelId: string,
  currentUser: { id: string; role: string; hotelId?: string },
): void {
  if (currentUser.role !== 'super_admin' && resourceHotelId !== currentUser.hotelId) {
    throw new AuthError('No autorizado')
  }
}

/** Resuelve hotelId desde el token o la DB. */
export async function resolveHotelId(
  currentUser: { id: string; role: string; hotelId?: string },
  userRepo: { findById: (id: string) => Promise<{ hotelId?: string } | null> },
): Promise<string | undefined> {
  if (currentUser.hotelId) return currentUser.hotelId
  if (currentUser.role !== 'super_admin') {
    const user = await userRepo.findById(currentUser.id)
    return user?.hotelId
  }
  return undefined
}
