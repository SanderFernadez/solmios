import type { HttpRequest, Logger } from 'arckode-framework'
import { validateSchema } from 'arckode-framework'
import type { FileUpload } from 'arckode-framework/modules/storage'
import type { HousekeepingService } from './service'
import { CreateHousekeepingSchema, UpdateHousekeepingSchema } from './validators/schema'

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
    const { photo, fileName } = (req.body ?? {}) as { photo?: string; fileName?: string }
    if (!photo) return { status: 400, body: { error: 'No se envió foto (base64 en body.photo)' } }
    const parsed = parseDataUrl(photo)
    if (!parsed) return { status: 400, body: { error: 'Formato inválido (se espera data URL base64)' } }
    const file: FileUpload = {
      fieldName: 'file',
      originalName: fileName || `photo.${parsed.ext}`,
      buffer: parsed.buffer,
      mimeType: parsed.mimeType,
      size: parsed.buffer.length,
    }
    return { status: 201, body: await this.service.addPhoto(req.params.id, file, req.user as any) }
  }

  async removePhoto(req: HttpRequest) {
    const photoUrl = req.query['url'] || req.query['photoUrl']
    if (!photoUrl) return { status: 400, body: { error: 'url de foto requerida' } }
    return { status: 200, body: await this.service.removePhoto(req.params.id, String(photoUrl), req.user as any) }
  }

  async stats(req: HttpRequest) {
    return { status: 200, body: await this.service.stats(req.query as any, req.user as any) }
  }
}
