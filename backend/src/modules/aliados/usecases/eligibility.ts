// aliados/usecases/eligibility.ts — ¿Puede este hotel convertirse en Aliado?
// Umbral: más de 5 referidos VALIDADOS (mismo status que referrals/model.ts:ReferralsModel,
// 'validated' = cumplió activeMonthsRequired meses pagando). Estrictamente > 5, no >= 5.
import type { RepositoryAdapter } from 'arckode-framework'
import type { EligibilityDTO } from '../types'

export const MIN_VALIDATED_REFERRALS_FOR_ALIADO = 5

export async function checkEligibility(
  referralsRepo: RepositoryAdapter<any>,
  partnersRepo: RepositoryAdapter<any>,
  hotelId: string,
): Promise<EligibilityDTO> {
  const validated = (await referralsRepo.findMany({ referrerHotelId: hotelId, status: 'validated' })) as any[]
  const validatedCount = validated.length

  const existingPartner = (await partnersRepo.findMany({ hotelId })) as any[]
  const alreadyPartner = existingPartner.length > 0

  return {
    validatedCount,
    isEligible: validatedCount > MIN_VALIDATED_REFERRALS_FOR_ALIADO,
    alreadyPartner,
  }
}
