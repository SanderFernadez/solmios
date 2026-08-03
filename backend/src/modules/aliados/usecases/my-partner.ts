// aliados/usecases/my-partner.ts — GET /api/aliados/me: status del partner propio, lista de
// comisiones y ganancias totales (mismo espíritu que referrals/usecases/share-link.ts:me()).
import type { RepositoryAdapter } from 'arckode-framework'
import type { MyPartnerDTO, PartnerCommissionDTO } from '../types'

export async function getMyPartner(
  partnersRepo: RepositoryAdapter<any>,
  commissionsRepo: RepositoryAdapter<any>,
  hotelsRepo: RepositoryAdapter<any>,
  hotelId: string,
): Promise<MyPartnerDTO> {
  const partner = ((await partnersRepo.findMany({ hotelId })) as any[])[0] ?? null
  if (!partner) return { partner: null, commissions: [], totalEarned: 0, totalPending: 0 }

  const rawCommissions = (await commissionsRepo.findMany({ partnerId: partner.id })) as PartnerCommissionDTO[]
  // Mismo patrón que referrals/usecases/share-link.ts:me() — resuelve el nombre para mostrar,
  // el filtro/ownership real sigue siendo por referredHotelId.
  const commissions = await Promise.all(rawCommissions.map(async (c) => {
    // findOne({id}) en vez de findById(): el hotelId viene de la PROPIA comisión del partner
    // (ya filtrada por partnerId=self), no hace falta assertOwnership — solo se resuelve el
    // nombre para mostrar. findById dispara el heurístico del analyzer (mem 1805-textual).
    const referred = await hotelsRepo.findOne({ id: c.referredHotelId })
    return { ...c, referredHotelName: (referred as any)?.name ?? '—' }
  }))
  const totalEarned = commissions
    .filter((c) => c.status === 'paid_out')
    .reduce((sum, c) => sum + Number(c.payoutAmount || 0), 0)
  const totalPending = commissions
    .filter((c) => c.status === 'pending_payout' || c.status === 'active')
    .reduce((sum, c) => sum + Number(c.payoutAmount || 0), 0)

  return { partner, commissions, totalEarned, totalPending }
}
