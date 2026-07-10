// empleados/usecases/validate-employee.ts — Shared validation for child records
// Ensures employeeId belongs to the same hotelId before creating contracts, documents, etc.

import type { RepositoryAdapter } from 'arckode-framework'
import { ValidationError } from 'arckode-framework'

export async function validateEmployeeBelongsToHotel(
  profileRepo: RepositoryAdapter<any>,
  employeeId: string,
  hotelId: string,
): Promise<void> {
  const profile = await profileRepo.findOne({ userId: employeeId, hotelId })
  if (!profile) {
    throw new ValidationError('Employee does not belong to this hotel')
  }
}
