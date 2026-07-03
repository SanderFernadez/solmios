import type { RepositoryAdapter, Logger } from 'arckode-framework'
import type { PricingQueries } from './usecases/pricing-queries'

export class PricingService {
  constructor(
    private readonly seasonsRepo: RepositoryAdapter<any>,
    private readonly ratesRepo: RepositoryAdapter<any>,
    private readonly blocksRepo: RepositoryAdapter<any>,
    private readonly restrictionsRepo: RepositoryAdapter<any>,
    private readonly logger: Logger,
    private readonly queries?: PricingQueries,
  ) {}

  async listSeasons(hotelId: string): Promise<any[]> {
    const data = await this.seasonsRepo.findMany({ hotelId }) as any[]
    return data.sort((a: any, b: any) => (a.sortOrder || 0) - (b.sortOrder || 0))
  }

  async updateSeasons(hotelId: string, seasons: any[]): Promise<number> {
    const existing = await this.seasonsRepo.findMany({ hotelId }) as any[]
    for (const ex of existing) await this.seasonsRepo.delete(ex.id)
    for (let i = 0; i < seasons.length; i++) {
      const s = seasons[i]
      await this.seasonsRepo.create({
        id: crypto.randomUUID(), hotelId, name: s.name || `season-${i}`, label: s.label || '',
        startDate: s.startDate || '', endDate: s.endDate || '',
        color: s.color || '#3b82f6', sortOrder: i,
      })
    }
    return seasons.length
  }

  async listRates(hotelId: string): Promise<any[]> {
    return await this.ratesRepo.findMany({ hotelId }) as any[]
  }

  async updateRates(hotelId: string, rates: any[]): Promise<number> {
    let saved = 0
    for (const r of rates) {
      if (!r.roomType || !r.season || r.occupancy === undefined) continue
      const basePrice = r.basePrice ?? 0; const percentage = r.percentage ?? 0
      const price = Math.round(basePrice * (1 + percentage / 100) * 100) / 100
      const closed = r.closed ? 1 : 0
      const existing = (await this.ratesRepo.findMany({ hotelId, roomType: r.roomType, occupancy: r.occupancy, season: r.season }))[0] as any
      if (existing) await this.ratesRepo.update(existing.id, { basePrice, percentage, price, closed })
      else await this.ratesRepo.create({ id: crypto.randomUUID(), hotelId, roomType: r.roomType, occupancy: r.occupancy, season: r.season, basePrice, percentage, price, closed })
      saved++
    }
    return saved
  }

  async copyRatesNextYear(hotelId: string): Promise<{ copied: number; total: number }> {
    const rates = await this.ratesRepo.findMany({ hotelId }) as any[]
    let copied = 0
    for (const r of rates) {
      const nextYear = String(r.season || '').replace(/\d{4}/, String(new Date().getFullYear() + 1))
      const exists = (await this.ratesRepo.findMany({ hotelId, roomType: r.roomType, occupancy: r.occupancy, season: nextYear }))[0]
      if (!exists) { await this.ratesRepo.create({ id: crypto.randomUUID(), hotelId, roomType: r.roomType, occupancy: r.occupancy, season: nextYear, price: r.price, basePrice: r.basePrice, percentage: r.percentage }); copied++ }
    }
    return { copied, total: rates.length }
  }

  async listBlocks(hotelId: string, startDate?: string, endDate?: string): Promise<any[]> {
    let data = await this.blocksRepo.findMany({ hotelId }) as any[]
    if (startDate && endDate) data = data.filter((b: any) => b.startDate <= endDate && b.endDate >= startDate)
    return data
  }

  async createBlocks(hotelId: string, userId: string, roomIds: string[], reason: string, startDate: string, endDate: string): Promise<any[]> {
    const created: any[] = []
    for (const roomId of roomIds) {
      created.push(await this.blocksRepo.create({ id: crypto.randomUUID(), hotelId, roomId, reason: reason || '', startDate, endDate, createdBy: userId }))
    }
    return created
  }

  async deleteBlock(id: string): Promise<void> {
    await this.blocksRepo.delete(id)
  }

  async listRateRestrictions(hotelId: string): Promise<any[]> {
    return await this.restrictionsRepo.findMany({ hotelId }) as any[]
  }

  async updateRateRestrictions(hotelId: string, restrictions: any[]): Promise<number> {
    let saved = 0
    for (const r of restrictions) {
      if (!r.roomType || !r.season) continue
      const existing = (await this.restrictionsRepo.findMany({ hotelId, roomType: r.roomType, season: r.season }))[0] as any
      if (existing) {
        await this.restrictionsRepo.update(existing.id, { minStay: r.minStay ?? 0, maxStay: r.maxStay ?? 0, cta: r.cta ?? 0, ctd: r.ctd ?? 0, closedToArrival: r.closedToArrival ?? 0, closedToDeparture: r.closedToDeparture ?? 0 })
      } else {
        await this.restrictionsRepo.create({ id: crypto.randomUUID(), hotelId, roomType: r.roomType, season: r.season, minStay: r.minStay ?? 0, maxStay: r.maxStay ?? 0, cta: r.cta ?? 0, ctd: r.ctd ?? 0, closedToArrival: r.closedToArrival ?? 0, closedToDeparture: r.closedToDeparture ?? 0 })
      }
      saved++
    }
    return saved
  }

  async getChannelMetrics(hotelId: string): Promise<any[]> {
    if (!this.queries) throw new Error('Queries no disponible')
    return this.queries.getChannelMetrics(hotelId)
  }
}
