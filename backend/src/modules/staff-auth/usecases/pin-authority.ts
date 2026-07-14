// staff-auth/usecases/pin-authority.ts — Quién puede plantar/resetear el PIN de quién.
//
// setPin/resetPin dan acceso: quien setea un PIN puede después loguearse como ese usuario (con el
// rol de ese usuario). Sin este control, un hotel_admin ponía un PIN en el super_admin de otro
// hotel y se logueaba como super_admin → escalada + takeover cross-tenant.
//
// Reglas:
//   - super_admin: puede gestionar el PIN de cualquiera.
//   - hotel_admin: SOLO usuarios de su propio hotel Y de rol operativo (nunca otro admin ni el
//     super_admin — no puede tocar un par ni un superior).

import { AuthError } from 'arckode-framework'

interface ActorLike { id: string; role?: string; hotelId?: string | null }
interface TargetLike { id: string; role?: string; hotelId?: string | null }

const PRIVILEGED_ROLES = new Set(['super_admin', 'hotel_admin'])

export function assertCanManagePin(admin: ActorLike, target: TargetLike): void {
  if (admin.role === 'super_admin') return

  // hotel_admin (único otro rol que llega acá; el resto ya se rechazó antes):
  if (!admin.hotelId || admin.hotelId !== target.hotelId) {
    throw new AuthError('No autorizado: el usuario pertenece a otro hotel')
  }
  if (PRIVILEGED_ROLES.has(target.role ?? '')) {
    throw new AuthError('No autorizado: no puede gestionar el PIN de un administrador')
  }
}
