// housekeeping/usecases/staff.ts — Validación del empleado asignado a una tarea.
//
// `staffId` es el id de un USUARIO (`users.id`), no el de un `employee_profile`.
// Así lo manda la app y lo compara `list()` contra `housekeeping.staffId`.
// Validarlo contra `employeeRepo` (otra PK) hacía fallar TODA asignación.

import type { RepositoryAdapter } from 'arckode-framework'
import { AuthError, ValidationError } from 'arckode-framework'
import type { HousekeepingUser } from '../types'

export async function assertStaffExists(
  userRepo: RepositoryAdapter<any>,
  staffId: string | undefined,
  currentUser: HousekeepingUser,
): Promise<void> {
  if (!staffId) return
  const staff = await userRepo.findById(staffId).catch(() => null)
  if (!staff) throw new ValidationError('staffId no corresponde a un empleado válido')
  if (currentUser.role !== 'super_admin' && staff.hotelId !== currentUser.hotelId) {
    throw new AuthError('staffId no pertenece a tu hotel')
  }
}
