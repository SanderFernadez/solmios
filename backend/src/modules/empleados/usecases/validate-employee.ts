// empleados/usecases/validate-employee.ts — Shared validation for child records
// Ensures employeeId belongs to the same hotelId before creating contracts, documents, etc.

import type { RepositoryAdapter } from 'arckode-framework'
import { ValidationError } from 'arckode-framework'

export async function validateEmployeeBelongsToHotel(
  profileRepo: RepositoryAdapter<any>,
  employeeId: string,
  hotelId: string,
): Promise<void> {
  // Los formularios (contrato/documento/ausencia/evaluación) mandan el id del employee_profile,
  // no el userId. Buscar sólo por userId hacía que un empleado válido diera SIEMPRE
  // "no pertenece al hotel". Se aceptan ambas claves para no romper ningún flujo.
  const byId = await profileRepo.findOne({ id: employeeId, hotelId })
  if (byId) return
  const byUser = await profileRepo.findOne({ userId: employeeId, hotelId })
  if (byUser) return
  throw new ValidationError('El empleado no pertenece a este hotel')
}
