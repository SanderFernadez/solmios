// hoteles/sockets.ts — Hooks OPCIONALES hacia otros módulos
// Los sockets son opcionales. El módulo funciona sin ellos.
// Un conector puede pasar sockets para reaccionar a eventos del módulo.

import type { HotelesDTO } from './types'

export interface HotelesSockets {
  onHotelesCreated?: (data: HotelesDTO) => Promise<void>
  onHotelesUpdated?: (data: HotelesDTO) => Promise<void>
  onHotelesDeleted?: (id: string) => Promise<void>
}
