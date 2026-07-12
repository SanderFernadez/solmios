// usuarios/controller.ts — Adaptador HTTP
import type { HttpRequest, Logger, RepositoryAdapter } from 'arckode-framework'
import { validateSchema } from 'arckode-framework'
import type { StorageService } from 'arckode-framework/modules/storage'
import { CreateUsuarioSchema, UpdateUsuarioSchema, LoginSchema, ChangePasswordSchema, ForgotPasswordSchema, ResetPasswordSchema, UpdateProfileSchema } from './validators/schema'
import type { UsuariosService } from './service'
import { parseDataUrl, isImage } from '../../shared/utils/data-url'
import { canAssignRole, systemRolesForCreator } from './usecases/assignable-role'

export class UsuariosController {
  constructor(
    private readonly service: UsuariosService,
    private readonly logger: Logger,
    private readonly storage?: StorageService,
    // Tabla `roles` del hotel: para dejar asignar roles PERSONALIZADOS al crear un usuario, no solo
    // los del sistema. Sin esto, un rol custom se crea pero no se puede asignar a nadie.
    private readonly roleRepo?: RepositoryAdapter<any>,
  ) {}

  async login(req: HttpRequest) {
    const data = validateSchema(LoginSchema, req.body) as any
    // Sin catch: `AuthError` ya viaja como 401 y `ValidationError` como 400.
    // Atraparlos acá convertía cualquier fallo interno (ORM, red) en
    // "Credenciales inválidas", que es la respuesta más engañosa posible.
    const result = await this.service.login(data.email, data.password)
    return { status: 200, body: result }
  }

  async me(req: HttpRequest) {
    const user = await this.service.me((req.user as any).id)
    return { status: 200, body: user }
  }

  /** Edita el perfil propio. Siempre el del token: no recibe un id. */
  async updateMe(req: HttpRequest) {
    const data = validateSchema(UpdateProfileSchema, req.body) as any
    const user = await this.service.updateProfile((req.user as any).id, data)
    return { status: 200, body: user }
  }

  /** Sube la foto de perfil y la deja guardada en el usuario del token. */
  async uploadAvatar(req: HttpRequest) {
    if (!this.storage) return { status: 500, body: { error: 'Storage no configurado' } }
    const body = (req.body ?? {}) as { photo?: string; fileName?: string }
    if (!body.photo) return { status: 400, body: { error: 'Falta el campo photo (data URL base64)' } }

    const parsed = parseDataUrl(body.photo)
    if (!parsed) return { status: 400, body: { error: 'Formato inválido (se espera data URL base64)' } }
    if (!isImage(parsed.mimeType)) return { status: 400, body: { error: 'Solo se permiten imágenes' } }

    const userId = (req.user as any).id
    const stored = await this.storage.upload(
      {
        fieldName: 'file',
        originalName: body.fileName || `avatar-${userId}.${parsed.ext}`,
        buffer: parsed.buffer,
        mimeType: parsed.mimeType,
        size: parsed.buffer.length,
      },
      'avatars',
    )
    const user = await this.service.updateProfile(userId, { avatar: stored.url })
    return { status: 201, body: user }
  }

  async logout(req: HttpRequest) {
    await this.service.logout((req.user as any).id)
    return { status: 200, body: { message: 'Sesión cerrada' } }
  }

  async refresh(req: HttpRequest) {
    const body = (req.body || {}) as { refreshToken?: string }
    if (!body.refreshToken) {
      return { status: 400, body: { error: 'refreshToken requerido' } }
    }
    const result = await this.service.refreshToken(body.refreshToken)
    return { status: 200, body: result }
  }

  async changePassword(req: HttpRequest) {
    const data = validateSchema(ChangePasswordSchema, req.body) as any
    await this.service.changePassword((req.user as any).id, data.currentPassword, data.newPassword)
    return { status: 200, body: { message: 'Contraseña actualizada' } }
  }

  async forgotPassword(req: HttpRequest) {
    const data = validateSchema(ForgotPasswordSchema, req.body) as any
    await this.service.forgotPassword(data.email)
    return { status: 200, body: { message: 'Si el email existe, recibirás un enlace de recuperación' } }
  }

  async resetPassword(req: HttpRequest) {
    const data = validateSchema(ResetPasswordSchema, req.body) as any
    await this.service.resetPassword(data.token, data.newPassword)
    return { status: 200, body: { message: 'Contraseña restablecida' } }
  }

  async index(req: HttpRequest) {
    const user = req.user as any
    const hotelId = user.role === 'super_admin' ? undefined : (user.hotelId || undefined)
    if (user.role !== 'super_admin' && !user.hotelId) {
      return { status: 403, body: { error: 'Sin hotel asignado' } }
    }
    const data = await this.service.list(hotelId)
    return { status: 200, body: { data, total: data.length } }
  }

  async store(req: HttpRequest) {
    const data = validateSchema(CreateUsuarioSchema, req.body) as any
    const isSuperAdmin = (req.user as any).role === 'super_admin'
    // super_admin crea usuarios para cualquier hotel → respeta hotelId del body (onboarding de nuevos hoteles).
    // hotel_admin/recepcionista se anclan a su propio hotel (multi-tenant seguro, leído del token).
    if (!isSuperAdmin) data.hotelId = (req.user as any).hotelId
    if (data.role && !isSuperAdmin) {
      const callerRole = (req.user as any).role
      // Un rol del sistema va por jerarquía; si no lo es, se busca como rol personalizado del propio
      // hotel (scoped por hotelId → nadie asigna el rol de otro hotel).
      let customNames: string[] = []
      if (this.roleRepo && data.hotelId && !systemRolesForCreator(callerRole).includes(data.role)) {
        const rows = await this.roleRepo.findMany({ hotelId: data.hotelId, name: data.role })
        customNames = rows.map((r: any) => r.name)
      }
      if (!canAssignRole(callerRole, data.role, customNames)) {
        return { status: 403, body: { error: `No puede crear usuarios con rol ${data.role}` } }
      }
    } else if (!isSuperAdmin && !data.role) {
      // Default to receptionist for non-superAdmins (safer than hotel_admin)
      data.role = 'receptionist'
    }
    const item = await this.service.create(data)
    return { status: 201, body: item }
  }

  async update(req: HttpRequest) {
    const existing = await this.service.me(req.params.id)
    const isSuperAdmin = (req.user as any).role === 'super_admin'
    if (!isSuperAdmin && existing.hotelId !== (req.user as any).hotelId) {
      return { status: 403, body: { error: 'No autorizado' } }
    }
    const data = validateSchema(UpdateUsuarioSchema, req.body)
    // FC-B2 Seguridad: hotel_admin no puede asignar ni quitar rol super_admin (privilege escalation)
    if (!isSuperAdmin && data.role === 'super_admin') {
      return { status: 403, body: { error: 'No autorizado para asignar rol super_admin' } }
    }
    const item = await this.service.update(req.params.id, data)
    return { status: 200, body: item }
  }

  async destroy(req: HttpRequest) {
    const existing = await this.service.me(req.params.id)
    const isSuperAdmin = (req.user as any).role === 'super_admin'
    if (!isSuperAdmin && existing.hotelId !== (req.user as any).hotelId) {
      return { status: 403, body: { error: 'No autorizado' } }
    }
    await this.service.delete(req.params.id)
    return { status: 204, body: null }
  }

  // PC-2 Multi-property
  async hotels(req: HttpRequest) {
    try {
      const data = await this.service.getHotels((req.user as any).id, (req.user as any).role)
      return { status: 200, body: { data } }
    } catch (e: any) {
      return { status: 500, body: { error: e.message } }
    }
  }

  async switchHotel(req: HttpRequest) {
    try {
      const result = await this.service.switchHotel(
        (req.user as any).id,
        req.params.id,
        (req.user as any).role,
      )
      return { status: 200, body: result }
    } catch (e: any) {
      if (e.message.includes('No autorizado')) return { status: 403, body: { error: e.message } }
      return { status: 404, body: { error: e.message } }
    }
  }
}
