// referrals/usecases/metrics.ts — Dashboard del admin (PLAN-REFERIDOS.md §6).
import type { RepositoryAdapter } from 'arckode-framework'
import type { ReferralMetricsDTO } from '../types'

export interface MetricsDeps {
  referralsRepo: RepositoryAdapter<any>
  referralCreditsRepo: RepositoryAdapter<any>
  hotelsRepo: RepositoryAdapter<any>
}

export async function getReferralMetrics(deps: MetricsDeps): Promise<ReferralMetricsDTO> {
  const { referralsRepo, referralCreditsRepo, hotelsRepo } = deps
  const referrals = (await referralsRepo.findMany({})) as any[]
  const credits = (await referralCreditsRepo.findMany({ status: 'released' })) as any[]

  const totalReferrals = referrals.length
  const validatedCount = referrals.filter((r) => r.status === 'validated').length
  const conversionPct = totalReferrals > 0 ? Math.round((validatedCount / totalReferrals) * 100) : 0
  const totalMonthsGranted = credits.reduce((sum, c) => sum + Number(c.monthsGranted || 0), 0)

  const byReferrer = new Map<string, number>()
  for (const r of referrals) {
    if (r.status !== 'validated') continue
    byReferrer.set(r.referrerHotelId, (byReferrer.get(r.referrerHotelId) ?? 0) + 1)
  }
  const topEntries = [...byReferrer.entries()].sort((a, b) => b[1] - a[1]).slice(0, 5)
  const topReferrers = await Promise.all(topEntries.map(async ([hotelId, validatedCount]) => {
    const hotel = await hotelsRepo.findById(hotelId)
    return { hotelId, hotelName: (hotel as any)?.name ?? '—', validatedCount }
  }))

  return { totalReferrals, validatedCount, conversionPct, totalMonthsGranted, topReferrers }
}
