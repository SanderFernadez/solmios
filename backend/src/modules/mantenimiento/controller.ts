import type { HttpRequest, Logger } from 'arckode-framework'
import { validateSchema } from '../../shared/validators/validate-body'
import type { MantenimientoService } from './service'
import { CreateMantenimientoSchema, UpdateMantenimientoSchema, AddNotesSchema, CompleteMantenimientoSchema, AddPhotoMantenimientoSchema } from './validators/schema'

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
    const data = validateSchema(CompleteMantenimientoSchema, req.body || {}) as any
    const item = await this.service.complete(req.params.id, currentUser, data.notes)
    return { status: 200, body: item }
  }

  // ─── Notes ────────────────────────────────────────────
  async addNotes(req: HttpRequest) {
    const currentUser = req.user as any
    const { notes } = validateSchema(AddNotesSchema, req.body) as { notes: string }
    const item = await this.service.addNotes(req.params.id, notes, currentUser)
    return { status: 200, body: item }
  }

  // ─── Photos ───────────────────────────────────────────
  async addPhoto(req: HttpRequest) {
    const currentUser = req.user as any
    const file = (req as any).file as { buffer: Buffer; originalname: string; mimetype: string; size: number } | undefined
    if (!file) return { status: 400, body: { error: 'Archivo requerido' } }
    const data = validateSchema(AddPhotoMantenimientoSchema, req.body || {}) as any
    const fileUpload = { buffer: file.buffer, originalName: file.originalname, mimeType: file.mimetype, size: file.size }
    const item = await this.service.addPhoto(req.params.id, fileUpload as any, data.type, currentUser)
    return { status: 200, body: item }
  }

  async removePhoto(req: HttpRequest) {
    const currentUser = req.user as any
    const photoUrl = (req.query as any).url as string | undefined
    if (!photoUrl) return { status: 400, body: { error: 'url de foto requerida (?url=...)' } }
    const item = await this.service.removePhoto(req.params.id, photoUrl, currentUser)
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
    // Ownership: hotel_admin/receptionist SIEMPRE usan su propio hotel (ignoran query.hotelId).
    // Solo super_admin puede pedir stats de otro hotel vía query param.
    const hotelId = user.role === 'super_admin' ? ((req.query as any).hotelId || user.hotelId) : user.hotelId
    if (!hotelId) return { status: 400, body: { error: 'hotelId requerido' } }
    const stats = await this.service.getStats(hotelId)
    return { status: 200, body: stats }
  }
}
