// usuarios/usecases/list-hotels.ts — Hoteles visibles para un usuario.
// super_admin ve todos; el resto solo el suyo. Extraído del service para mantenerlo
// por debajo del límite de líneas (God Object) — misma lógica, sin cambios de comportamiento.

import type { RepositoryAdapter } from 'arckode-framework'

export async function listUserHotels(
  repo: RepositoryAdapter<any>,
  hotelRepo: RepositoryAdapter<any> | undefined,
  userId: string,
  role: string,
): Promise<any[]> {
  if (!hotelRepo) return []
  const hotels = await hotelRepo.findMany({})
  if (role === 'super_admin') return hotels.map(({ ...rest }: any) => rest)
  // @ignore IDOR_RISK — `userId` sale del JWT (req.user.id), es un self-lookup para resolver su hotel.
  const user = await repo.findById(userId)
  if (!user) return []
  return hotels.filter((h: any) => h.id === user.hotelId)
}
