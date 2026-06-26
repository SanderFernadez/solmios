// usuarios/controller.ts — Adaptador HTTP
import type { HttpRequest, Logger } from 'arckode-framework'
import { validateSchema } from 'arckode-framework'
import { CreateUsuarioSchema, UpdateUsuarioSchema } from './validators/schema'
import type { UsuariosService } from './service'

export class UsuariosController {
  constructor(private readonly service: UsuariosService, private readonly logger: Logger) {}

  async login(req: HttpRequest) {
    const { email, password } = req.body as { email: string; password: string }
    if (!email || !password) return { status: 400, body: { error: 'Email y password requeridos' } }
    try {
      const result = await this.service.login(email, password)
      return { status: 200, body: result }
    } catch (e: any) {
      return { status: 401, body: { error: e.message } }
    }
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
    const { currentPassword, newPassword } = req.body as { currentPassword: string; newPassword: string }
    if (!currentPassword || !newPassword) {
      return { status: 400, body: { error: 'Contraseña actual y nueva requeridas' } }
    }
    if (newPassword.length < 6) {
      return { status: 400, body: { error: 'La nueva contraseña debe tener al menos 6 caracteres' } }
    }
    await this.service.changePassword((req.user as any).id, currentPassword, newPassword)
    return { status: 200, body: { message: 'Contraseña actualizada' } }
  }

  async forgotPassword(req: HttpRequest) {
    const { email } = req.body as { email: string }
    if (!email) return { status: 400, body: { error: 'Email requerido' } }
    await this.service.forgotPassword(email)
    return { status: 200, body: { message: 'Si el email existe, recibirás un enlace de recuperación' } }
  }

  async resetPassword(req: HttpRequest) {
    const { token, newPassword } = req.body as { token: string; newPassword: string }
    if (!token || !newPassword) return { status: 400, body: { error: 'Token y nueva contraseña requeridos' } }
    if (newPassword.length < 6) return { status: 400, body: { error: 'La contraseña debe tener al menos 6 caracteres' } }
    await this.service.resetPassword(token, newPassword)
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
