// activos/sockets.ts — Hooks OPCIONALES hacia otros módulos
// Los sockets son opcionales. El módulo funciona sin ellos.
// Un conector puede pasar sockets para reaccionar a eventos del módulo.

import type { ActivosDTO } from './types'

export interface ActivosSockets {
  onActivosCreated?: (data: ActivosDTO) => Promise<void>
  onActivosUpdated?: (data: ActivosDTO) => Promise<void>
  onActivosDeleted?: (id: string) => Promise<void>
}
