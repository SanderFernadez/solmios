import type { HttpRequest, Logger } from 'arckode-framework'
import { validateSchema } from '../../shared/validators/validate-body'
import type { FileUpload } from 'arckode-framework/modules/storage'
import type { HousekeepingService } from './service'
import { CreateHousekeepingSchema, UpdateHousekeepingSchema, UploadPhotoSchema, RemovePhotoSchema, ReportIssueSchema } from './validators/schema'

// Decodifica un data URL base64 (data:<mime>;base64,<data>) → buffer + metadata.
// Necesario porque el router del framework no propaga req.files al handler,
// así que las fotos viajan como base64 en el body JSON.
function parseDataUrl(dataUrl: string): { buffer: Buffer; mimeType: string; ext: string } | null {
  const m = dataUrl.match(/^data:([^;]+);base64,(.*)$/s)
  if (!m) return null
  const mimeType = m[1]
  const buffer = Buffer.from(m[2], 'base64')
  const ext = (mimeType.split('/')[1] ?? 'bin').split(';')[0]
  return { buffer, mimeType, ext }
}

export class HousekeepingController {
  constructor(
    private readonly service: HousekeepingService,
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
    const data = validateSchema(CreateHousekeepingSchema, req.body)
    const item = await this.service.create(data as any, currentUser)
    return { status: 201, body: item }
  }

  async update(req: HttpRequest) {
    const currentUser = req.user as any
    const data = validateSchema(UpdateHousekeepingSchema, req.body)
    const item = await this.service.update(req.params.id, data as any, currentUser)
    return { status: 200, body: item }
  }

  async destroy(req: HttpRequest) {
    const currentUser = req.user as any
    await this.service.delete(req.params.id, currentUser)
    return { status: 204, body: null }
  }

  // ─── Endpoints de administración (F3) ──────────────────────────────────────
  async start(req: HttpRequest) {
    return { status: 200, body: await this.service.start(req.params.id, req.user as any) }
  }

  async complete(req: HttpRequest) {
    return { status: 200, body: await this.service.complete(req.params.id, req.user as any) }
  }

  async uploadPhoto(req: HttpRequest) {
    const data = validateSchema(UploadPhotoSchema, req.body ?? {}) as any
    const parsed = parseDataUrl(data.photo)
    if (!parsed) return { status: 400, body: { error: 'Formato inválido (se espera data URL base64)' } }
    const file: FileUpload = {
      fieldName: 'file',
      originalName: data.fileName || `photo.${parsed.ext}`,
      buffer: parsed.buffer,
      mimeType: parsed.mimeType,
      size: parsed.buffer.length,
    }
    return { status: 201, body: await this.service.addPhoto(req.params.id, file, req.user as any) }
  }

  async removePhoto(req: HttpRequest) {
    const data = validateSchema(RemovePhotoSchema, { url: req.query['url'] || req.query['photoUrl'] }) as any
    return { status: 200, body: await this.service.removePhoto(req.params.id, data.url, req.user as any) }
  }

  async stats(req: HttpRequest) {
    return { status: 200, body: await this.service.stats(req.query as any, req.user as any) }
  }

  // ─── Aprobación y presencia (F4/F5) ───────────────────────────────────────
  async approve(req: HttpRequest) {
    const body = (req.body || {}) as Record<string, unknown>
    const note = body.note as string | undefined
    const result = await this.service.approve(req.params.id, (req.user as any).id, note)
    return { status: 200, body: result }
  }

  async reject(req: HttpRequest) {
    const body = (req.body || {}) as Record<string, unknown>
    const note = body.note as string | undefined
    const result = await this.service.reject(req.params.id, (req.user as any).id, note)
    return { status: 200, body: result }
  }

  async presence(req: HttpRequest) {
    await this.service.markPresence(req.params.id, (req.user as any).id)
    return { status: 200, body: { message: 'Presencia registrada' } }
  }

  async report(req: HttpRequest) {
    const currentUser = req.user as any
    // Antes esto solo comprobaba que `description` existiera: se podía mandar un
    // texto de cualquier largo, y de ahí viajaba al ticket y a la notificación.
    const data = validateSchema(ReportIssueSchema, req.body) as { description: string; type?: string }
    await this.service.reportIssue(req.params.id, data.description, data.type ?? 'maintenance', currentUser)
    return { status: 200, body: { message: 'Reporte enviado' } }
  }

  // ─── Photo Requirements y Supply Lists ────────────────────────────────────
  async photoRequirements(req: HttpRequest) {
    const hotelId = (req.user as any).hotelId
    const roomType = req.query['roomType'] as string | undefined
    const items = await this.service.getPhotoRequirements(hotelId, roomType)
    return { status: 200, body: { data: items } }
  }

  async updatePhotoRequirements(req: HttpRequest) {
    const hotelId = (req.user as any).hotelId
    const body = (req.body || {}) as Record<string, unknown>
    const items = (body.items || []) as any[]
    const result = await this.service.upsertPhotoRequirements(hotelId, items)
    return { status: 200, body: { data: result } }
  }

  async supplyLists(req: HttpRequest) {
    const hotelId = (req.user as any).hotelId
    const roomType = req.query['roomType'] as string | undefined
    const items = await this.service.getSupplyLists(hotelId, roomType)
    return { status: 200, body: { data: items } }
  }

  async updateSupplyLists(req: HttpRequest) {
    const hotelId = (req.user as any).hotelId
    const body = (req.body || {}) as Record<string, unknown>
    const roomType = body.roomType as string | undefined
    const items = (body.items || []) as any[]
    if (!roomType) return { status: 400, body: { error: 'roomType requerido' } }
    const result = await this.service.upsertSupplyLists(hotelId, roomType, items)
    return { status: 200, body: { data: result } }
  }
}
