// messages/validators/schema.ts — Validación de entrada
import type { BodyRule } from '../../../shared/validators/validate-body'

/** Un mensaje de chat interno: párrafos, no documentos. */
const MAX_MESSAGE_LENGTH = 4000
/** Ruta de la foto subida (`/uploads/...`), no un data URI. */
const MAX_PHOTO_URL_LENGTH = 2000

/**
 * `message` es `type: 'text'` a propósito: el `string` del framework colapsa
 * TODO el whitespace (`\s+`→' '), incluidos los saltos de línea. Eso rompía los
 * mensajes multilínea Y las respuestas (que separan autor/cita/cuerpo con `\n`).
 * `text` recorta los bordes pero preserva los saltos internos.
 */
export const SendMessageSchema: Record<string, BodyRule> = {
  toUserId: { type: 'string' as const, required: true },
  message: { type: 'text' as const, max: MAX_MESSAGE_LENGTH },
  photoUrl: { type: 'string' as const, max: MAX_PHOTO_URL_LENGTH },
}

export const MessagesValidator = { SendMessageSchema }
