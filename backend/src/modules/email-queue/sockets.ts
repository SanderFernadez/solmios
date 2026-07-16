// email-queue/sockets.ts — Hooks OPCIONALES hacia otros módulos.
// El módulo funciona sin ellos. Un conector puede pasar sockets para reaccionar a
// un reencolado manual (ej: auditar quién reintentó un email fallido).
import type { EmailQueueDTO } from './types'

export interface EmailQueueSockets {
  onEmailRequeued?: (data: EmailQueueDTO) => Promise<void>
}
