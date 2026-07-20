import type { RepositoryAdapter } from 'arckode-framework'

/**
 * hotelId del usuario buscándolo en Users, para tokens LEGACY que no lo traen
 * embebido (emitidos antes de que el JWT llevara hotelId — ver
 * infrastructure/auth/hotel-auth.ts). Los tokens actuales no necesitan esto:
 * `req.user.hotelId` ya viene resuelto.
 *
 * Compartido por amenities/pricing/ttlock (mismo fallback, copiado en los tres
 * controllers) para no repetir la función en cada service y no volver a
 * empujar ninguno sobre las 200 líneas (gate `arckode analyze`).
 *
 * Antes cada controller llamaba a `(this.service as any).orm?.findMany?.(...)`
 * — un `orm` que ninguno de los tres services tuvo nunca. `?.` lo convertía en
 * `undefined` sin error, y el fallback quedaba muerto en silencio.
 */
export async function hotelIdOfUserLegacy(
  usersRepo: RepositoryAdapter<any> | undefined,
  userId: string | undefined,
): Promise<string | undefined> {
  if (!userId || !usersRepo) return undefined
  const rows = await usersRepo.findMany({ id: userId }).catch(() => [])
  return (rows as any[])?.[0]?.hotelId
}
