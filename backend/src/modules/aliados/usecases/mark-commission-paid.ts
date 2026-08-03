// aliados/usecases/mark-commission-paid.ts — Un super_admin registra manualmente que YA pagó
// una comisión. NO hay integración de pago automático (ni Stripe payouts ni transferencias
// bancarias, fuera de alcance): esto es un registro, el movimiento de dinero lo hace el humano
// por fuera del sistema. Aplica tanto a 'monthly' (un pago puntual del período) como a
// 'one_time' ya liberada (status 'pending_payout' → tras liberarse queda lista para pagar).
import type { RepositoryAdapter } from 'arckode-framework'
import { ValidationError, NotFoundError } from 'arckode-framework'
import type { PartnerCommissionDTO } from '../types'

export async function markPaid(
  commissionsRepo: RepositoryAdapter<any>,
  id: string,
): Promise<PartnerCommissionDTO> {
  const commission = (await commissionsRepo.findMany({ id }))[0] as any
  if (!commission) throw new NotFoundError('Comisión no encontrada')
  if (commission.status === 'cancelled') throw new ValidationError('No se puede marcar como pagada una comisión cancelada')

  return commissionsRepo.update(id, {
    status: 'paid_out',
    paidAt: new Date().toISOString(),
  }) as unknown as Promise<PartnerCommissionDTO>
}
