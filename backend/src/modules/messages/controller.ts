import type { HttpRequest } from 'arckode-framework'
import { validateSchema } from 'arckode-framework'
import type { FileUpload, StorageService } from 'arckode-framework/modules/storage'
import type { MessagesService } from './service'
import { SendMessageSchema } from './validators/schema'

// Decodifica un data URL base64 (data:<mime>;base64,<data>) → buffer + metadata.
function parseDataUrl(dataUrl: string): { buffer: Buffer; mimeType: string; ext: string } | null {
  const m = dataUrl.match(/^data:([^;]+);base64,(.*)$/s)
  if (!m) return null
  const mimeType = m[1]
  const buffer = Buffer.from(m[2], 'base64')
  const ext = (mimeType.split('/')[1] ?? 'bin').split(';')[0]
  return { buffer, mimeType, ext }
}

export class MessagesController {
  constructor(
    private readonly service: MessagesService,
    private readonly storage?: StorageService,
  ) {}

  // El kernel ya envuelve toda respuesta en {success, data}. Envolver acá otra vez
  // producía {success, data:{success, data:[...]}} y obligaba al cliente a
  // desenvolver dos veces para adivinar dónde estaba el array.

  async conversations(req: HttpRequest) {
    const user = req.user as any
    const result = await this.service.getConversations(user)
    return { status: 200, body: result }
  }

  async messagesWith(req: HttpRequest) {
    const user = req.user as any
    const result = await this.service.getMessagesWith(req.params.userId, user)
    return { status: 200, body: result }
  }

  /** Compañeros del hotel. Sirve al chat sin exigir el permiso `users:view`. */
  async contacts(req: HttpRequest) {
    const user = req.user as any
    const result = await this.service.getContacts(user)
    return { status: 200, body: result }
  }

  async send(req: HttpRequest) {
    const user = req.user as any
    const body = validateSchema(SendMessageSchema, req.body) as { toUserId: string; message?: string; photoUrl?: string | null }
    const item = await this.service.sendMessage(body.toUserId, body.message || '', body.photoUrl || null, user)
    return { status: 201, body: item }
  }

  async markRead(req: HttpRequest) {
    const user = req.user as any
    await this.service.markAsRead(req.params.id, user)
    return { status: 200, body: { message: 'Marcado como leído' } }
  }

  async allConversations(req: HttpRequest) {
    const user = req.user as any
    const result = await this.service.getAllConversations(user)
    return { status: 200, body: result }
  }

  async uploadPhoto(req: HttpRequest) {
    if (!this.storage) return { status: 500, body: { error: 'Storage no configurado' } }
    const body = (req.body ?? {}) as { photo?: string; fileName?: string }
    const photo = body.photo
    if (!photo) return { status: 400, body: { error: 'Falta el campo photo (data URL base64)' } }
    const parsed = parseDataUrl(photo)
    if (!parsed) return { status: 400, body: { error: 'Formato inválido (se espera data URL base64)' } }
    if (!parsed.mimeType.startsWith('image/')) {
      return { status: 400, body: { error: 'Solo se permiten imágenes' } }
    }
    const file: FileUpload = {
      fieldName: 'file',
      originalName: body.fileName || `chat-${Date.now()}.${parsed.ext}`,
      buffer: parsed.buffer,
      mimeType: parsed.mimeType,
      size: parsed.buffer.length,
    }
    const stored = await this.storage.upload(file, 'chat')
    return { status: 201, body: { url: stored.url } }
  }
}
