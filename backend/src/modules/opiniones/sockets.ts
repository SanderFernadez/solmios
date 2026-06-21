// opiniones/sockets.ts — Hooks OPCIONALES hacia otros módulos
// Los sockets son opcionales. El módulo funciona sin ellos.
// Un conector puede pasar sockets para reaccionar a eventos del módulo.

import type { OpinionesDTO } from './types'

export interface OpinionesSockets {
  onOpinionesCreated?: (data: OpinionesDTO) => Promise<void>
  onOpinionesUpdated?: (data: OpinionesDTO) => Promise<void>
  onOpinionesDeleted?: (id: string) => Promise<void>
}
