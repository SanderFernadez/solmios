// reservas/usecases/reservation-ownership.ts — Helper multi-tenant para recursos
// que cuelgan de una reserva (companions, addons). Verifica que la reservation
// pertenezca al hotel del usuario. super_admin bypass vía auth.assertOwnership.

import type { RepositoryAdapter, Auth } from 'arckode-framework'
import { NotFoundError } from 'arckode-framework'

export interface SimpleUser {
  id: string
  role: string
  hotelId?: string
}

/**
 * Verifica que una reservation pertenezca al hotel del user.
 * Devuelve la reservation (para reutilizar su hotelId en el alta del recurso).
 */
export async function assertReservationOwned(
  reservationRepo: RepositoryAdapter<any>,
  userRepo: RepositoryAdapter<any>,
  auth: Auth,
  reservationId: string,
  user: SimpleUser,
): Promise<any> {
  const res = await reservationRepo.findById(reservationId)
  if (!res) throw new NotFoundError('Reserva no encontrada')
  const me = await userRepo.findById(user.id)
  auth.assertOwnership(res.hotelId, me?.hotelId ?? '', user.role, 'super_admin')
  return res
}
