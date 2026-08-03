// aliados/usecases/payout-mode.ts — El Aliado normal elige cómo cobra: mensual (mientras el
// hotel referido siga activo) o pago único (1 mes completo, liberado tras la ventana de
// validación). El Aliado Certificado NO puede elegir: siempre 'monthly' (PartnersModel.payoutMode
// se fuerza en la conversión/aprobación, y este usecase rechaza cualquier intento de cambiarlo).
import type { RepositoryAdapter } from 'arckode-framework'
import { ValidationError, NotFoundError } from 'arckode-framework'
import type { PartnerDTO, PayoutMode } from '../types'

const VALID_MODES: PayoutMode[] = ['monthly', 'one_time']

export async function setPayoutMode(
  partnersRepo: RepositoryAdapter<any>,
  hotelId: string,
  mode: string,
): Promise<PartnerDTO> {
  if (!VALID_MODES.includes(mode as PayoutMode)) {
    throw new ValidationError(`payoutMode debe ser uno de: ${VALID_MODES.join(', ')}`)
  }

  const partner = (await partnersRepo.findMany({ hotelId }))[0] as any
  if (!partner) throw new NotFoundError('El hotel no es Aliado')

  if (partner.type === 'aliado_certificado') {
    throw new ValidationError('Aliado Certificado no puede elegir pago único')
  }

  return partnersRepo.update(partner.id, { payoutMode: mode }) as unknown as Promise<PartnerDTO>
}
