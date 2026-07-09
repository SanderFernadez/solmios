// messages/sockets.ts — Contrato de eventos del módulo (para conectores).
// Opcionales: el módulo funciona sin ellos.
import type { MessageDTO } from './types'

export interface MessagesSockets {
  onMessageSent?: (message: MessageDTO) => Promise<void> | void
  onMessageRead?: (message: MessageDTO) => Promise<void> | void
}
