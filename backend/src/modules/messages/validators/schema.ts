// messages/validators/schema.ts — Validación de entrada
import type { ValidationRule } from 'arckode-framework'

/** Un mensaje de chat interno: párrafos, no documentos. */
const MAX_MESSAGE_LENGTH = 4000
/** Ruta de la foto subida (`/uploads/...`), no un data URI. */
const MAX_PHOTO_URL_LENGTH = 2000

/** Necesita destinatario y, al menos, texto o foto — la segunda regla la aplica el service. */
export const SendMessageSchema: Record<string, ValidationRule> = {
  toUserId: { type: 'string' as const, required: true },
  message: { type: 'string' as const, max: MAX_MESSAGE_LENGTH },
  photoUrl: { type: 'string' as const, max: MAX_PHOTO_URL_LENGTH },
}

export const MessagesValidator = { SendMessageSchema }
