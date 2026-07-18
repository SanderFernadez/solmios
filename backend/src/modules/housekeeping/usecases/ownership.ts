// housekeeping/usecases/ownership.ts — Quién puede tocar la evidencia (fotos/video) de una tarea.
//
// A diferencia del cronómetro (start/complete, solo el dueño o un admin), la evidencia
// la tocan DOS actores: la camarera dueña (sus fotos/video de fin) y el supervisor (la
// foto de presencia, `areaId="supervisor_presence"`, cuando el hotel la exige). Por eso
// el supervisor está en el bypass acá pero NO en `assertAssignedStaff` de timings.

import { AuthError } from 'arckode-framework'
import type { HousekeepingUser } from '../types'

/** Roles que operan la evidencia de CUALQUIER tarea del hotel (no solo la propia). */
const EVIDENCE_BYPASS_ROLES = ['super_admin', 'hotel_admin', 'receptionist', 'supervisor']

/**
 * Impone que quien sube/borra/mira evidencia sea del hotel de la tarea Y, si es
 * personal de a pie (housekeeper), que sea la tarea asignada a él. Sin esto, una
 * camarera con `housekeeping:edit` podía manipular las fotos de la tarea de otra.
 */
export function assertCanEditEvidence(
  task: { hotelId?: string; staffId?: string },
  user: HousekeepingUser,
): void {
  if (user.role !== 'super_admin' && task.hotelId !== user.hotelId) {
    throw new AuthError('No autorizado')
  }
  if (!EVIDENCE_BYPASS_ROLES.includes(user.role) && task.staffId !== user.id) {
    throw new AuthError('No autorizado: no es la tarea asignada a este empleado')
  }
}
