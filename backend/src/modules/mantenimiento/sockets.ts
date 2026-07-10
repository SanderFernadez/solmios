// mantenimiento/sockets.ts — Hooks OPCIONALES hacia otros módulos
// Los sockets son opcionales. El módulo funciona sin ellos.
// Un conector puede pasar sockets para reaccionar a eventos del módulo.

import type { MantenimientoDTO } from './types'

export interface MantenimientoSockets {
  onMantenimientoCreated?: (data: MantenimientoDTO) => Promise<void>
  onMantenimientoUpdated?: (data: MantenimientoDTO) => Promise<void>
  onMantenimientoDeleted?: (id: string) => Promise<void>
  /** El ticket pasó a manos de un técnico. Solo dispara cuando `assignedTo`
   *  cambia, no en cada update — para avisarle a esa persona sin spamear. */
  onMantenimientoAssigned?: (data: MantenimientoDTO) => Promise<void>
}
