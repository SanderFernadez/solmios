import type { HttpRequest, Logger } from 'arckode-framework'
import { validateSchema } from 'arckode-framework'
import type { RolesService } from './service'
import { CreateRolesSchema, UpdateRolesSchema } from './validators/schema'

export class RolesController {
  constructor(
    private readonly service: RolesService,
    private readonly logger: Logger,
  ) {}

  async index(req: HttpRequest) {
    const currentUser = req.user as any
    const result = await this.service.list(req.query as any, currentUser)
    return { status: 200, body: result }
  }

  async show(req: HttpRequest) {
    const currentUser = req.user as any
    const item = await this.service.getById(req.params.id, currentUser)
    return { status: 200, body: item }
  }

  async store(req: HttpRequest) {
    const currentUser = req.user as any
    const data = validateSchema(CreateRolesSchema, req.body)
    const item = await this.service.create(data as any, currentUser)
    return { status: 201, body: item }
  }

  async update(req: HttpRequest) {
    const currentUser = req.user as any
    const data = validateSchema(UpdateRolesSchema, req.body)
    const payload = { ...data } as any
    if (req.body && (req.body as any).permissions !== undefined) {
      const perms = (req.body as any).permissions
      // Validate permissions structure: must be array of {module: string, actions: string[]}
      if (!Array.isArray(perms)) {
        return { status: 400, body: { error: 'permissions must be an array' } }
      }
      for (const p of perms) {
        if (!p.module || !Array.isArray(p.actions)) {
          return { status: 400, body: { error: 'Each permission must have module (string) and actions (array)' } }
        }
      }
      payload.permissions = perms
    }
    const item = await this.service.update(req.params.id, payload, currentUser)
    return { status: 200, body: item }
  }

  async destroy(req: HttpRequest) {
    const currentUser = req.user as any
    await this.service.delete(req.params.id, currentUser)
    return { status: 204, body: null }
  }
}
