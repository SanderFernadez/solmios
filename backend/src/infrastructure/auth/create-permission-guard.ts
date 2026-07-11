import type { MiddlewareHandler, RepositoryAdapter, Auth } from 'arckode-framework'
import { loadPermissions } from './load-permissions'
import { requirePermission } from './require-permission'

/**
 * Create a middleware array that combines authentication + permission checking.
 * This is the recommended way to protect routes with fine-grained permissions.
 *
 * @example
 * // In module's create():
 * const guard = createPermissionGuard(auth, roleRepo)
 *
 * // Use in routes:
 * router.get('/api/reservations', ...guard('reservations', 'view'), handler)
 * router.post('/api/reservations', ...guard('reservations', 'create'), handler)
 * router.delete('/api/reservations/:id', ...guard('reservations', 'delete'), handler)
 */
export function createPermissionGuard(
  auth: Auth,
  roleRepo: RepositoryAdapter<any>,
  // Autorización por PERMISO, no por nombre de rol. Antes esto era una whitelist fija de 6 roles del
  // sistema: un rol personalizado (ej "Cajero") lo rechazaba `authenticate` ANTES de mirar permisos,
  // así que los roles custom no servían para nada. `authenticate()` sin roles exige token válido y deja
  // que `requirePermission` decida. Un rol sin el permiso igual recibe 403 — falla cerrado.
  allowedRoles: string[] = [],
) {
  return (module: string, action: string): [MiddlewareHandler, MiddlewareHandler, MiddlewareHandler] => {
    return [
      auth.authenticate(...allowedRoles),
      loadPermissions(roleRepo),
      requirePermission(module, action),
    ]
  }
}
