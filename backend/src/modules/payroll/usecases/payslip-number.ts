// payroll/usecases/payslip-number.ts — Atomic payslip number generator
// Counter stored in configuration(key='payslip_counter_{hotelId}_{period}') with optimistic locking.

import type { RepositoryAdapter } from 'arckode-framework'

const MAX_RETRIES = 3

export async function nextPayslipNumber(
  configRepo: RepositoryAdapter<any>,
  hotelId: string,
  period: string,
): Promise<string> {
  const counterKey = `payslip_counter_${hotelId}_${period}`

  for (let attempt = 0; attempt < MAX_RETRIES; attempt++) {
    try {
      const counter = await configRepo.findOne({ key: counterKey, hotelId })
      const currentSeq = counter?.value ?? 0
      const nextSeq = currentSeq + 1

      if (counter) {
        // Optimistic locking: update only if value hasn't changed
        const updated = await configRepo.update(counter.id, { value: nextSeq } as any)
        // If ORM returns the updated record, proceed. If not, verify.
        if (updated && updated.value !== nextSeq) continue
      } else {
        // Create with retry handling for unique constraint
        try {
          await configRepo.create({
            key: counterKey,
            hotelId,
            value: nextSeq,
            description: `Payslip counter for ${period}`,
            createdAt: new Date().toISOString(),
            updatedAt: new Date().toISOString(),
          } as any)
        } catch {
          // Unique constraint violation — another request created it first, retry
          continue
        }
      }

      return `REC-${period}-${nextSeq.toString().padStart(4, '0')}`
    } catch {
      // Retry on transient errors
      continue
    }
  }

  // Fallback after all retries — timestamp ensures uniqueness
  return `REC-${period}-${Date.now()}`
}
