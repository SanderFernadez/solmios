// index.ts — StaffAuth Module
import { createModule, OrmRepository } from 'arckode-framework'
import { registerStaffAuthModels } from './model'
import { StaffAuthService } from './service'
import { StaffAuthController } from './controller'
import { rateLimit, resetAttempts, getClientIp } from '../../shared/middlewares/rate-limit'

export { StaffAuthService }
export { PinLoginSchema, PinSetSchema } from './validators/schema'

export function StaffAuthModule() {
  return createModule({
    name: 'staff-auth',
    version: '2.0.0',
    description: 'Login por PIN para staff móvil con bcrypt + rate limiting',
    contract: {
      name: 'staff-auth',
      version: '2.0.0',
      description: 'Secure PIN-based authentication for mobile staff',
      actions: ['loginByPin', 'setPin', 'resetPin'],
      events: [],
      tables: [],
      dependencies: [],
      rules: ['No auth required for loginByPin', 'Admin required for setPin/resetPin'],
    },
    create({ logger, orm, router, auth }) {
      if (!auth) throw new Error('staff-auth: auth dependency required')
      registerStaffAuthModels(orm)
      const userRepo = new OrmRepository<any>(orm, 'Users')
      const service = new StaffAuthService(userRepo, logger, auth)
      const controller = new StaffAuthController(service, logger)

      // PIN login — NO requiere autenticación. Rate limit por IP además del lockout
      // por cuenta que ya hace el service (pinAttempts/pinLockedUntil): esto cubre el
      // caso de un atacante probando PINs contra MUCHOS teléfonos distintos desde la
      // misma IP, que el lockout por cuenta no frena.
      router.post('/api/housekeeping/auth/pin', async (req) => {
        const key = `pin-login:${getClientIp(req)}`
        const { allowed, retryAfter } = await rateLimit(key)
        if (!allowed) {
          return { status: 429, body: { error: `Demasiados intentos. Intentá en ${retryAfter} segundos` } }
        }
        // phone/pin faltantes o PIN incorrecto: 400/AuthError, no llega a resetear.
        const result = await controller.loginByPin(req)
        if (result.status < 400) await resetAttempts(key)
        return result
      })

      // PIN management — requiere autenticación de admin del hotel
      const adminOnly = [auth.authenticate('hotel_admin', 'super_admin')]
      router.post('/api/staff-auth/pin-set', adminOnly, (req) => controller.setPin(req))
      router.post('/api/staff-auth/pin-reset/:userId', adminOnly, (req) => controller.resetPin(req))

      logger.info('Módulo staff-auth v2.0 listo (bcrypt + rate limiting)')
      return service
    },
  })
}
