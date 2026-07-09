// usuarios/controller.ts — Adaptador HTTP
import type { HttpRequest, Logger } from 'arckode-framework'
import { validateSchema } from 'arckode-framework'
import { CreateUsuarioSchema, UpdateUsuarioSchema, LoginSchema, ChangePasswordSchema, ForgotPasswordSchema, ResetPasswordSchema } from './validators/schema'
import type { UsuariosService } from './service'

export class UsuariosController {
  constructor(private readonly service: UsuariosService, private readonly logger: Logger) {}

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

  async logout(req: HttpRequest) {
    await this.service.logout((req.user as any).id)
    return { status: 200, body: { message: 'Sesión cerrada' } }
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
    const data = validateSchema(CreateUsuarioSchema, req.body)
    const isSuperAdmin = (req.user as any).role === 'super_admin'
    // super_admin crea usuarios para cualquier hotel → respeta hotelId del body (onboarding de nuevos hoteles).
    // hotel_admin/recepcionista se anclan a su propio hotel (multi-tenant seguro, leído del token).
    if (!isSuperAdmin) data.hotelId = (req.user as any).hotelId
    if (data.role && !isSuperAdmin) delete data.role
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
