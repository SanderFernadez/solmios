// aliados/usecases/convert-to-aliado.ts — Alta de un Partner tipo 'aliado'. Acción MANUAL
// (el hotel la pide o un admin la aprueba), NUNCA automática — así lo pide el issue #549:
// pasar el umbral de elegibilidad no convierte solo, hay una decisión de por medio.
import type { RepositoryAdapter } from 'arckode-framework'
import { ValidationError, ConflictError } from 'arckode-framework'
import { checkEligibility, MIN_VALIDATED_REFERRALS_FOR_ALIADO } from './eligibility'
import type { PartnerDTO } from '../types'

export async function convertToAliado(
  partnersRepo: RepositoryAdapter<any>,
  referralsRepo: RepositoryAdapter<any>,
  hotelId: string,
): Promise<PartnerDTO> {
  const { isEligible, alreadyPartner } = await checkEligibility(referralsRepo, partnersRepo, hotelId)

  if (alreadyPartner) throw new ConflictError('El hotel ya es Aliado')
  if (!isEligible) {
    throw new ValidationError(
      `El hotel necesita más de ${MIN_VALIDATED_REFERRALS_FOR_ALIADO} referidos validados para convertirse en Aliado`,
    )
  }

  const now = new Date().toISOString()
  return partnersRepo.create({
    id: crypto.randomUUID(),
    hotelId,
    type: 'aliado',
    payoutMode: 'monthly',
    status: 'active',
    becamePartnerAt: now,
    certifiedAt: null,
  } as any)
}
