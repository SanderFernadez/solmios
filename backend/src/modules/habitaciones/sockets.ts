// habitaciones/sockets.ts — Hooks OPCIONALES hacia otros módulos
// Los sockets son opcionales. El módulo funciona sin ellos.
// Un conector puede pasar sockets para reaccionar a eventos del módulo.

import type { HabitacionesDTO } from './types'

export interface HabitacionesSockets {
  onHabitacionesCreated?: (data: HabitacionesDTO) => Promise<void>
  onHabitacionesUpdated?: (data: HabitacionesDTO) => Promise<void>
  onHabitacionesDeleted?: (id: string) => Promise<void>
}
