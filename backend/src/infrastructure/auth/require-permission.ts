import type { MiddlewareHandler } from 'arckode-framework'
import { ForbiddenError } from 'arckode-framework'
import { hasPermission, type Permission } from '../../shared/permissions'

/**
 * Middleware que verifica si el usuario tiene un permiso específico.
 * El permiso se obtiene del rol del usuario (almacenado en la DB).
 *
 * @example
 * router.get('/api/reservations', [requirePermission('reservations', 'view')], handler)
 * router.post('/api/reservations', [requirePermission('reservations', 'create')], handler)
 */
export function requirePermission(module: string, action: string): MiddlewareHandler {
  return async (req, next) => {
    const user = req.user as any
    if (!user) {
      throw new ForbiddenError('Authentication required')
    }

    // Super_admin always has access
    if (user.role === 'super_admin') {
      return next()
    }

    // Get user's permissions from their role
    // The permissions should be loaded during authentication
    const permissions: Permission[] = user.permissions || []

    if (!hasPermission(permissions, module, action)) {
      throw new ForbiddenError(`Sin permiso: ${module}:${action}`)
    }

    return next()
  }
}
