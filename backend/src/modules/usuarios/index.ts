// usuarios/index.ts — PUERTA PÚBLICA (auth + gestión de usuarios)
import { createModule, OrmRepository } from 'arckode-framework'
import { jwtTokenAdapter } from 'arckode-framework/adapters/jwt'
import type { StorageService } from 'arckode-framework/modules/storage'
import { bodyLimit } from 'arckode-framework/middlewares'
import { registerUsuariosModels } from './model'
import { UsuariosService } from './service'
import { UsuariosController } from './controller'
import { rateLimit, resetAttempts } from '../../shared/middlewares/rate-limit'
import { createPermissionGuard } from '../../infrastructure/auth/create-permission-guard'

export { UsuariosService }
export type { UsuarioDTO } from './types'

/** Una foto de perfil es una sola imagen: 5 MB de base64 sobra de largo. */
const AVATAR_UPLOAD_LIMIT = 5 * 1024 * 1024

export function UsuariosModule(opts: { storage?: StorageService } = {}) {
  return createModule({
    name: 'usuarios',
    version: '1.0.0',
    description: 'Autenticación y gestión de usuarios del hotel',
    contract: {
      name: 'usuarios', version: '1.0.0',
      description: 'Login JWT + CRUD de empleados del hotel',
      actions: ['login', 'me', 'updateMe', 'uploadAvatar', 'logout', 'list', 'create', 'update', 'delete', 'changePassword', 'getHotels', 'switchHotel'],
      events: ['user.created', 'user.disabled'],
      tables: ['users'],
      dependencies: [],
      rules: ['Password hasheado bcrypt', 'Login emite JWT', 'Solo hotel_admin gestiona usuarios', 'El perfil propio no requiere users:edit'],
    },
    create({ logger, orm, cache, router, auth }) {
      if (!auth) throw new Error('usuarios: auth dependency required')
      registerUsuariosModels(orm)
      const repo = new OrmRepository<any>(orm, 'Users')
      const hotelRepo = new OrmRepository<any>(orm, 'Hotels')
      const log = logger.child('usuarios')
      const service = new UsuariosService(repo, log, cache, auth, hotelRepo)
      const roleRepo = new OrmRepository<any>(orm, 'Roles')
      const controller = new UsuariosController(service, log, opts.storage, roleRepo)

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
      // `me` y `logout` operan sobre el propio usuario del token, no sobre la
      // tabla de usuarios: pedirles `users:view` dejaba a supervisor, camarera y
      // mantenimiento sin poder leer su propio perfil ni cerrar sesión (403).
      router.get('/api/auth/me', [auth.authenticate()], (req) => controller.me(req))
      // El perfil propio: `users:edit` es el permiso para editar a OTROS. Sin estas
      // rutas, una camarera no podía ni cambiarse el nombre ni ponerse una foto.
      router.put('/api/auth/me', [auth.authenticate()], (req) => controller.updateMe(req))
      router.post('/api/auth/avatar', [auth.authenticate(), bodyLimit(AVATAR_UPLOAD_LIMIT)], (req) => controller.uploadAvatar(req))
      router.post('/api/auth/logout', [auth.authenticate()], (req) => controller.logout(req))
      // Cambia la contraseña del `req.user.id` del token y exige la actual:
      // `users:edit` es el permiso para editar a OTROS, no a uno mismo.
      router.post('/api/auth/change-password', [auth.authenticate()], (req) => controller.changePassword(req))
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
