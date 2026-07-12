// reclutamiento/sockets.ts — Hooks OPCIONALES hacia otros módulos.
// Un conector puede pasar sockets para reaccionar a eventos del pipeline (ej: al contratar,
// crear el expediente del empleado en el módulo empleados).

import type { ApplicantDTO } from './types'

export interface ReclutamientoSockets {
  onApplicantCreated?: (data: ApplicantDTO) => Promise<void>
  onApplicantHired?: (data: ApplicantDTO) => Promise<void>
  onApplicantRejected?: (data: ApplicantDTO) => Promise<void>
}
