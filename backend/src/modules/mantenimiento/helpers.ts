// mantenimiento/helpers.ts — Funciones compartidas del módulo
import { AuthError } from 'arckode-framework'

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
