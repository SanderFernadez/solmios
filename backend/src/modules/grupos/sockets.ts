// grupos/sockets.ts — Hooks OPCIONALES hacia otros módulos
// Los sockets son opcionales. El módulo funciona sin ellos.
// Un conector puede pasar sockets para reaccionar a eventos del módulo.

import type { GruposDTO } from './types'

export interface GruposSockets {
  onGruposCreated?: (data: GruposDTO) => Promise<void>
  onGruposUpdated?: (data: GruposDTO) => Promise<void>
  onGruposDeleted?: (id: string) => Promise<void>
}
