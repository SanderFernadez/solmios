// ai-gerente/sockets.ts — Hooks OPCIONALES hacia otros módulos
// Los sockets son opcionales. El módulo funciona sin ellos.
// Un conector puede pasar sockets para reaccionar a eventos del módulo.

import type { AiGerenteDTO } from './types'

export interface AiGerenteSockets {
  onAiGerenteCreated?: (data: AiGerenteDTO) => Promise<void>
  onAiGerenteUpdated?: (data: AiGerenteDTO) => Promise<void>
  onAiGerenteDeleted?: (id: string) => Promise<void>
}
