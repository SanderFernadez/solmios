// huespedes/sockets.ts — Hooks OPCIONALES hacia otros módulos
// Los sockets son opcionales. El módulo funciona sin ellos.
// Un conector puede pasar sockets para reaccionar a eventos del módulo.

import type { HuespedesDTO } from './types'

export interface HuespedesSockets {
  onHuespedesCreated?: (data: HuespedesDTO) => Promise<void>
  onHuespedesUpdated?: (data: HuespedesDTO) => Promise<void>
  onHuespedesDeleted?: (id: string) => Promise<void>
}
