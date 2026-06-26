// crm/usecases/ltv.ts — LTV calculation engine
import type { RepositoryAdapter, Logger } from 'arckode-framework'
import type { GuestLTV } from '../types'

export class LtvUseCase {
  constructor(
    private readonly guestRepo: RepositoryAdapter<any>,
    private readonly reservaRepo: RepositoryAdapter<any>,
    private readonly logger: Logger,
  ) {}

  async calculate(hotelId: string, limit = 50): Promise<GuestLTV[]> {
    const guests = await this.guestRepo.findMany({ hotelId, active: 1 })
    const now = new Date()
    const results: GuestLTV[] = []

    for (const g of guests.slice(0, limit)) {
      const reservations = await this.reservaRepo.findMany({ guestId: g.id, hotelId })
      const completed = reservations.filter((r: any) => r.status === 'checked_out')
      const first = completed.length > 0 ? completed.sort((a: any, b: any) => a.checkIn.localeCompare(b.checkIn))[0] : null
      const last = completed.length > 0 ? completed.sort((a: any, b: any) => b.checkOut.localeCompare(a.checkOut))[0] : null

      results.push({
        guestId: g.id, name: g.name, totalStays: g.totalStays ?? 0, totalSpent: g.totalSpent ?? 0,
        avgPerStay: g.totalStays > 0 ? Math.round((g.totalSpent / g.totalStays) * 100) / 100 : 0,
        loyaltyPoints: g.loyaltyPoints ?? 0, tier: g.tier ?? 'bronze',
        firstVisit: first?.checkIn ?? '', lastVisit: last?.checkOut ?? '',
        daysSinceLastVisit: last ? Math.floor((now.getTime() - new Date(last.checkOut).getTime()) / 86400000) : 999,
        ltvScore: this.score(g.totalSpent ?? 0, g.totalStays ?? 0, last?.checkOut),
      })
    }
    return results.sort((a, b) => b.ltvScore - a.ltvScore)
  }

  private score(spent: number, stays: number, lastVisit?: string): number {
    let s = Math.log10(spent + 1) * 10 + stays * 5
    if (lastVisit) { const d = Math.floor((new Date().getTime() - new Date(lastVisit).getTime()) / 86400000); if (d < 90) s += 20; else if (d < 180) s += 10 }
    return Math.round(s)
  }
}
