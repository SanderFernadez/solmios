import type { MiddlewareHandler } from 'arckode-framework'
import { AuthError } from 'arckode-framework'

/**
 * Middleware que verifica el userType del usuario (admin | merchant).
 * Usar en rutas que requieren un tipo específico de usuario.
 *
 * @example
 * router.get('/admin/hotels', [requireUserType('admin')], handler)
 * router.get('/panel/reservas', [requireUserType('merchant')], handler)
 */
export function requireUserType(...allowedTypes: string[]): MiddlewareHandler {
  return async (req, next) => {
    const user = req.user as any
    if (!user) {
      throw new AuthError('Authentication required')
    }

    const userType = user.userType || 'merchant' // default: merchant
    if (!allowedTypes.includes(userType)) {
      throw new AuthError(`Acceso denegado. Tipo de usuario requerido: ${allowedTypes.join(' o ')}`)
    }

    return next()
  }
}
