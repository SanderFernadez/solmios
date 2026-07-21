// capacitacion/sockets.ts — Hooks OPCIONALES hacia otros módulos
// Los sockets son opcionales. El módulo funciona sin ellos.
// Un conector puede pasar sockets para reaccionar a eventos del módulo.

import type { CapacitacionDTO, EnrollmentDTO } from './types'

export interface CapacitacionSockets {
  onCapacitacionCreated?: (data: CapacitacionDTO) => Promise<void>
  onCapacitacionUpdated?: (data: CapacitacionDTO) => Promise<void>
  onCapacitacionDeleted?: (id: string) => Promise<void>
  // Inscripción marcada 'completed' → el connector capacitacion-empleados lo registra en el expediente.
  onEnrollmentCompleted?: (enrollment: EnrollmentDTO, courseName?: string) => Promise<void>
}
