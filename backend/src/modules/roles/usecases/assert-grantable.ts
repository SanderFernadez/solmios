// roles/usecases/assert-grantable.ts — Nadie otorga permisos que no tiene (S-A2).
//
// Los endpoints de roles se protegen con `users:edit`/`users:create`. Sin este control, un rol
// con SOLO `users:edit` (ej. "recepción con gestión de usuarios") editaba su propio rol y se
// agregaba `billing:*` u otro permiso cualquiera → escalada. La regla: los permisos que se
// asignan a un rol deben estar cubiertos por los del editor.
//
// super_admin lleva `*:*` (cubre todo); hotel_admin lleva el set completo del hotel. Un rol
// acotado solo puede delegar lo que él mismo posee.

import { ForbiddenError } from 'arckode-framework'
import { hasPermission, type Permission } from '../../../shared/permissions'

export function assertGrantablePermissions(
  callerPermissions: Permission[] | undefined,
  requested: Permission[],
): void {
  const caller = callerPermissions ?? []
  for (const perm of requested) {
    const [module, action] = perm.split(':')
    if (!hasPermission(caller, module, action)) {
      throw new ForbiddenError(`No puede otorgar un permiso que usted no tiene: ${perm}`)
    }
  }
}
