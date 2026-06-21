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

  async index(req: HttpRequest) {
    const hotelId = (req.user as any).hotelId
    const data = await this.service.list(hotelId)
    return { status: 200, body: { data, total: data.length } }
  }

  async store(req: HttpRequest) {
    const data = validateSchema(CreateUsuarioSchema, req.body)
    data.hotelId = (req.user as any).hotelId
    if (data.role && (req.user as any).role !== 'super_admin') {
      delete data.role
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
}
