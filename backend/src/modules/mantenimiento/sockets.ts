// mantenimiento/sockets.ts — Hooks OPCIONALES hacia otros módulos
// Los sockets son opcionales. El módulo funciona sin ellos.
// Un conector puede pasar sockets para reaccionar a eventos del módulo.

import type { MantenimientoDTO } from './types'

export interface MantenimientoSockets {
  onMantenimientoCreated?: (data: MantenimientoDTO) => Promise<void>
  onMantenimientoUpdated?: (data: MantenimientoDTO) => Promise<void>
  onMantenimientoDeleted?: (id: string) => Promise<void>
}
