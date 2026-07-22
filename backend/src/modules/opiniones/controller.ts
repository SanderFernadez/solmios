import type { HttpRequest, Logger } from 'arckode-framework'
import { validateSchema } from 'arckode-framework'
import type { OpinionesService } from './service'
import { CreateOpinionesSchema, UpdateOpinionesSchema } from './validators/schema'

export class OpinionesController {
  constructor(
    private readonly service: OpinionesService,
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
    const data = validateSchema(CreateOpinionesSchema, req.body)
    const item = await this.service.create(data as any, currentUser)
    return { status: 201, body: item }
  }

  async update(req: HttpRequest) {
    const currentUser = req.user as any
    const data = validateSchema(UpdateOpinionesSchema, req.body)
    const item = await this.service.update(req.params.id, data as any, currentUser)
    return { status: 200, body: item }
  }

  async destroy(req: HttpRequest) {
    const currentUser = req.user as any
    await this.service.delete(req.params.id, currentUser)
    return { status: 204, body: null }
  }

  // ─── Público por token (sin auth: el token es la autorización) ───
  async publicGet(req: HttpRequest) {
    const data = await this.service.getByToken(req.params.token)
    if (!data) return { status: 404, body: { error: 'Reseña no encontrada' } }
    return { status: 200, body: data }
  }

  async publicSubmit(req: HttpRequest) {
    const body = (req.body ?? {}) as { rating?: number; comment?: string; title?: string }
    const result = await this.service.submitByToken(req.params.token, { rating: Number(body.rating), comment: body.comment, title: body.title })
    if (!result.ok) {
      const code = result.reason === 'not_found' ? 404 : result.reason === 'already_submitted' ? 409 : 400
      return { status: code, body: { error: result.reason } }
    }
    return { status: 200, body: { ok: true } }
  }
}
