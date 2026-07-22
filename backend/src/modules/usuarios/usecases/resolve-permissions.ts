// usuarios/usecases/resolve-permissions.ts — Permisos efectivos del rol de un usuario.
//
// MISMA lógica que el middleware `loadPermissions` (infrastructure/auth), pero para
// devolverlos en el payload de `/auth/me` y del login: el frontend los necesita para
// gatear menús/botones por `module:action` (los roles custom no matchean ningún nombre
// de rol hardcodeado en la UI). El backend sigue siendo la autoridad — esto es solo el
// espejo que le dice a la UI qué mostrar. Fuente de verdad: la tabla `roles` por
// (name + hotelId); si no hay fila, cae a los defaults del rol de sistema.

import type { RepositoryAdapter } from 'arckode-framework'
import { getRolePermissions } from '../../../shared/permissions'

export async function resolveUserPermissions(
  roleRepo: RepositoryAdapter<any> | undefined,
  role: string,
  hotelId?: string | null,
): Promise<string[]> {
  // super_admin: acceso total (mismo comodín que usa el middleware de permisos).
  if (role === 'super_admin') return ['*:*']

  if (!roleRepo || !hotelId) return getRolePermissions(role)

  try {
    const rows = await roleRepo.findMany({ name: role, hotelId })
    const custom = (rows?.[0] as any)?.permissions
    // getRolePermissions filtra el formato viejo (sin `:`) y cae a defaults si queda vacío.
    return getRolePermissions(role, custom)
  } catch {
    return getRolePermissions(role)
  }
}
