// capacitacion/sockets.ts — Hooks OPCIONALES hacia otros módulos
// Los sockets son opcionales. El módulo funciona sin ellos.
// Un conector puede pasar sockets para reaccionar a eventos del módulo.

import type { CapacitacionDTO } from './types'

export interface CapacitacionSockets {
  onCapacitacionCreated?: (data: CapacitacionDTO) => Promise<void>
  onCapacitacionUpdated?: (data: CapacitacionDTO) => Promise<void>
  onCapacitacionDeleted?: (id: string) => Promise<void>
}
