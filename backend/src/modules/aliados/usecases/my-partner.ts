// aliados/usecases/my-partner.ts — GET /api/aliados/me: status del partner propio, lista de
// comisiones y ganancias totales (mismo espíritu que referrals/usecases/share-link.ts:me()).
import type { RepositoryAdapter } from 'arckode-framework'
import type { MyPartnerDTO, PartnerCommissionDTO } from '../types'

export async function getMyPartner(
  partnersRepo: RepositoryAdapter<any>,
  commissionsRepo: RepositoryAdapter<any>,
  hotelId: string,
): Promise<MyPartnerDTO> {
  const partner = ((await partnersRepo.findMany({ hotelId })) as any[])[0] ?? null
  if (!partner) return { partner: null, commissions: [], totalEarned: 0, totalPending: 0 }

  const commissions = (await commissionsRepo.findMany({ partnerId: partner.id })) as PartnerCommissionDTO[]
  const totalEarned = commissions
    .filter((c) => c.status === 'paid_out')
    .reduce((sum, c) => sum + Number(c.payoutAmount || 0), 0)
  const totalPending = commissions
    .filter((c) => c.status === 'pending_payout' || c.status === 'active')
    .reduce((sum, c) => sum + Number(c.payoutAmount || 0), 0)

  return { partner, commissions, totalEarned, totalPending }
}
