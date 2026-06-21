// usuarios/index.ts — PUERTA PÚBLICA (auth + gestión de usuarios)
import { createModule, OrmRepository } from 'arckode-framework'
import { jwtTokenAdapter } from 'arckode-framework/adapters/jwt'
import { registerUsuariosModels } from './model'
import { UsuariosService } from './service'
import { UsuariosController } from './controller'
import { rateLimit, resetAttempts } from '../../middleware/rate-limit'

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
      actions: ['login', 'me', 'list', 'create', 'update', 'delete', 'changePassword'],
      events: ['user.created', 'user.disabled'],
      tables: ['users'],
      dependencies: [],
      rules: ['Password hasheado bcrypt', 'Login emite JWT', 'Solo hotel_admin gestiona usuarios'],
    },
    create({ logger, orm, cache, router, auth }) {
      if (!auth) throw new Error('usuarios: auth dependency required')
      registerUsuariosModels(orm)
      const repo = new OrmRepository<any>(orm, 'Users')
      const log = logger.child('usuarios')
      const service = new UsuariosService(repo, log, cache, auth)
      const controller = new UsuariosController(service, log)

      // Auth (públicas) — con rate limiting en login
      router.post('/api/auth/login', (req) => {
        const ip = (req as any).ip || 'unknown'
        const { allowed, retryAfter } = rateLimit(ip as string)
        if (!allowed) {
          return { status: 429, body: { error: `Demasiados intentos. Intentá en ${retryAfter} segundos` } }
        }
        return controller.login(req)
      })
      router.get('/api/auth/me', [auth.authenticate('hotel_admin', 'receptionist', 'super_admin')], (req) => controller.me(req))

      // Gestión de usuarios (hotel_admin + super_admin)
      router.get('/api/usuarios', [auth.authenticate('hotel_admin', 'super_admin')], (req) => controller.index(req))
      router.post('/api/usuarios', [auth.authenticate('hotel_admin', 'super_admin')], (req) => controller.store(req))
      router.put('/api/usuarios/:id', [auth.authenticate('hotel_admin', 'super_admin')], (req) => controller.update(req))
      router.delete('/api/usuarios/:id', [auth.authenticate('hotel_admin', 'super_admin')], (req) => controller.destroy(req))

      log.info('Módulo usuarios listo')
      return service
    },
  })
}
