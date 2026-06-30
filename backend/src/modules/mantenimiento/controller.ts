import type { HttpRequest, Logger } from 'arckode-framework'
import { validateSchema } from 'arckode-framework'
import type { MantenimientoService } from './service'
import { CreateMantenimientoSchema, UpdateMantenimientoSchema } from './validators/schema'

export class MantenimientoController {
  constructor(
    private readonly service: MantenimientoService,
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
    const data = validateSchema(CreateMantenimientoSchema, req.body)
    const item = await this.service.create(data as any, currentUser)
    return { status: 201, body: item }
  }

  async update(req: HttpRequest) {
    const currentUser = req.user as any
    const data = validateSchema(UpdateMantenimientoSchema, req.body)
    const item = await this.service.update(req.params.id, data as any, currentUser)
    return { status: 200, body: item }
  }

  async destroy(req: HttpRequest) {
    const currentUser = req.user as any
    await this.service.delete(req.params.id, currentUser)
    return { status: 204, body: null }
  }

  // ─── Timer ────────────────────────────────────────────
  async start(req: HttpRequest) {
    const currentUser = req.user as any
    const item = await this.service.start(req.params.id, currentUser)
    return { status: 200, body: item }
  }

  async complete(req: HttpRequest) {
    const currentUser = req.user as any
    const { notes } = (req.body || {}) as { notes?: string }
    const item = await this.service.complete(req.params.id, currentUser, notes)
    return { status: 200, body: item }
  }

  // ─── Notes ────────────────────────────────────────────
  async addNotes(req: HttpRequest) {
    const currentUser = req.user as any
    const { notes } = req.body as { notes: string }
    if (!notes) return { status: 400, body: { error: 'notes requerido' } }
    const item = await this.service.addNotes(req.params.id, notes, currentUser)
    return { status: 200, body: item }
  }

  // ─── Photos ───────────────────────────────────────────
  async addPhoto(req: HttpRequest) {
    const currentUser = req.user as any
    const file = (req as any).file as { buffer: Buffer; originalname: string; mimetype: string; size: number } | undefined
    if (!file) return { status: 400, body: { error: 'Archivo requerido' } }
    const type = (req.body as any)?.type || 'during'
    const fileUpload = { buffer: file.buffer, originalName: file.originalname, mimeType: file.mimetype, size: file.size }
    const item = await this.service.addPhoto(req.params.id, fileUpload as any, type, currentUser)
    return { status: 200, body: item }
  }

  // ─── Audit ────────────────────────────────────────────
  async auditHistory(req: HttpRequest) {
    const currentUser = req.user as any
    const history = await this.service.getAuditHistory(req.params.id, currentUser)
    return { status: 200, body: history }
  }

  // ─── Stats ────────────────────────────────────────────
  async stats(req: HttpRequest) {
    const user = req.user as any
    const hotelId = (req.query as any).hotelId || user.hotelId
    if (!hotelId) return { status: 400, body: { error: 'hotelId requerido' } }
    const stats = await this.service.getStats(hotelId)
    return { status: 200, body: stats }
  }
}
