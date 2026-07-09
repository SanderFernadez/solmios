// usuarios/index.ts — PUERTA PÚBLICA (auth + gestión de usuarios)
import { createModule, OrmRepository } from 'arckode-framework'
import { jwtTokenAdapter } from 'arckode-framework/adapters/jwt'
import { registerUsuariosModels } from './model'
import { UsuariosService } from './service'
import { UsuariosController } from './controller'
import { rateLimit, resetAttempts } from '../../shared/middlewares/rate-limit'
import { createPermissionGuard } from '../../infrastructure/auth/create-permission-guard'

export { UsuariosService }
export type { UsuarioDTO } from './types'

export function UsuariosModule() {
  return createModule({
    name: 'usuarios',
    version: '1.0.0',
    description: 'Autenticación y gestión de usuarios del hotel',
    contract: {
      name: 'usuarios', version: '1.0.0',
      description: 'Login JWT + CRUD de empleados del hotel',
      actions: ['login', 'me', 'logout', 'list', 'create', 'update', 'delete', 'changePassword', 'getHotels', 'switchHotel'],
      events: ['user.created', 'user.disabled'],
      tables: ['users'],
      dependencies: [],
      rules: ['Password hasheado bcrypt', 'Login emite JWT', 'Solo hotel_admin gestiona usuarios'],
    },
    create({ logger, orm, cache, router, auth }) {
      if (!auth) throw new Error('usuarios: auth dependency required')
      registerUsuariosModels(orm)
      const repo = new OrmRepository<any>(orm, 'Users')
      const hotelRepo = new OrmRepository<any>(orm, 'Hotels')
      const log = logger.child('usuarios')
      const service = new UsuariosService(repo, log, cache, auth, hotelRepo)
      const controller = new UsuariosController(service, log)

      const roleRepo = new OrmRepository<any>(orm, 'Roles')
      const guard = createPermissionGuard(auth, roleRepo)

      // Auth (públicas) — con rate limiting en login
      router.post('/api/auth/login', async (req) => {
        const ip = (req as any).ip || 'unknown'
        const { allowed, retryAfter } = rateLimit(ip as string)
        if (!allowed) {
          return { status: 429, body: { error: `Demasiados intentos. Intentá en ${retryAfter} segundos` } }
        }
        // Un login fallido lanza, así que no llega a resetear el contador.
        // Antes se reseteaba con cualquier resultado y el límite nunca se alcanzaba.
        const result = await controller.login(req)
        resetAttempts(ip as string)
        return result
      })
      router.get('/api/auth/me', guard('users', 'view'), (req) => controller.me(req))
      router.post('/api/auth/logout', guard('users', 'view'), (req) => controller.logout(req))
      router.post('/api/auth/change-password', guard('users', 'edit'), (req) => controller.changePassword(req))
      router.post('/api/auth/forgot-password', (req) => controller.forgotPassword(req))
      router.post('/api/auth/reset-password', (req) => controller.resetPassword(req))

      router.get('/api/auth/hotels', guard('users', 'view'), (req) => controller.hotels(req))
      router.post('/api/auth/switch-hotel/:id', guard('users', 'edit'), (req) => controller.switchHotel(req))

      router.get('/api/usuarios', guard('users', 'view'), (req) => controller.index(req))
      router.post('/api/usuarios', guard('users', 'create'), (req) => controller.store(req))
      router.put('/api/usuarios/:id', guard('users', 'edit'), (req) => controller.update(req))
      router.delete('/api/usuarios/:id', guard('users', 'delete'), (req) => controller.destroy(req))

      log.info('Módulo usuarios listo')
      return service
    },
  })
}
