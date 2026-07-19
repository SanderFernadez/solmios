// switch-hotel.ts — Cambiar el hotel activo de la sesión.
//
// El `super_admin` salta entre hoteles; un `hotel_admin` solo puede "cambiar" al
// suyo, que es lo que evita que con un id ajeno se emita un token para el hotel
// de otro.
import type { RepositoryAdapter, Auth } from 'arckode-framework'
import { NotFoundError, AuthError } from 'arckode-framework'
import { jtiOf } from './token-session'

export interface SwitchHotelDeps {
  repo: RepositoryAdapter<any>
  hotelRepo?: RepositoryAdapter<any>
  auth: Auth
}

export async function switchHotel(
  deps: SwitchHotelDeps,
  userId: string,
  targetHotelId: string,
  currentRole: string,
): Promise<{ token: string; refreshToken: string; user: any }> {
  if (!deps.hotelRepo) throw new AuthError('HotelRepo no disponible')
  const hotels = await deps.hotelRepo.findMany({})
  const hotel = hotels.find((h: any) => h.id === targetHotelId)
  if (!hotel) throw new NotFoundError('Hotel no encontrado')
  const user = await deps.repo.findById(userId)
  if (!user) throw new NotFoundError('Usuario no encontrado')

  if (currentRole !== 'super_admin' && user.hotelId !== targetHotelId) {
    throw new AuthError('No autorizado para este hotel')
  }

  const tokenPayload = { id: userId, role: currentRole, hotelId: targetHotelId, userType: 'merchant' }
  const token = (deps.auth as any).createToken(tokenPayload)
  const refreshToken = (deps.auth as any).createRefreshToken(tokenPayload)
  // Se guarda el jti del REFRESH (no el access), igual que en login: cambiar de
  // hotel abre una sesión nueva y su refresh tiene que quedar habilitado.
  await deps.repo.update(userId, { token: jtiOf(refreshToken) ?? null })

  return {
    token,
    refreshToken,
    user: {
      id: user.id, name: user.name, email: user.email,
      role: currentRole, hotelId: targetHotelId, hotelName: hotel.name,
    },
  }
}
