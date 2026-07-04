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
  allowedRoles: string[] = ['hotel_admin', 'receptionist', 'super_admin'],
) {
  return (module: string, action: string): [MiddlewareHandler, MiddlewareHandler, MiddlewareHandler] => {
    return [
      auth.authenticate(...allowedRoles),
      loadPermissions(roleRepo),
      requirePermission(module, action),
    ]
  }
}
