// index.ts — StaffAuth Module
import { createModule, OrmRepository } from 'arckode-framework'
import { registerStaffAuthModels } from './model'
import { StaffAuthService } from './service'
import { StaffAuthController } from './controller'

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

      // PIN login — NO requiere autenticación
      router.post('/api/housekeeping/auth/pin', (req) => controller.loginByPin(req))

      // PIN management — requiere autenticación de admin
      router.post('/api/staff-auth/pin-set', (req) => controller.setPin(req))
      router.post('/api/staff-auth/pin-reset/:userId', (req) => controller.resetPin(req))

      logger.info('Módulo staff-auth v2.0 listo (bcrypt + rate limiting)')
      return service
    },
  })
}
