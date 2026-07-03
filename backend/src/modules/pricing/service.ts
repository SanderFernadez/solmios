import type { Logger } from 'arckode-framework'

export class PricingService {
  constructor(
    private readonly orm: any,
    private readonly logger: Logger,
  ) {}

  async listSeasons(hotelId: string): Promise<any[]> {
    const data = await this.orm.findMany('Seasons', { hotelId }) as any[]
    return data.sort((a: any, b: any) => (a.sortOrder || 0) - (b.sortOrder || 0))
  }

  async updateSeasons(hotelId: string, seasons: any[]): Promise<number> {
    const existing = await this.orm.findMany('Seasons', { hotelId }) as any[]
    for (const ex of existing) await this.orm.delete('Seasons', ex.id)
    for (let i = 0; i < seasons.length; i++) {
      const s = seasons[i]
      await this.orm.create('Seasons', {
        id: crypto.randomUUID(), hotelId, name: s.name || `season-${i}`, label: s.label || '',
        startDate: s.startDate || '', endDate: s.endDate || '',
        color: s.color || '#3b82f6', sortOrder: i,
      })
    }
    return seasons.length
  }

  async listRates(hotelId: string): Promise<any[]> {
    return await this.orm.findMany('RoomRates', { hotelId }) as any[]
  }

  async updateRates(hotelId: string, rates: any[]): Promise<number> {
    let saved = 0
    for (const r of rates) {
      if (!r.roomType || !r.season || r.occupancy === undefined) continue
      const basePrice = r.basePrice ?? 0; const percentage = r.percentage ?? 0
      const price = Math.round(basePrice * (1 + percentage / 100) * 100) / 100
      const closed = r.closed ? 1 : 0
      const existing = (await this.orm.findMany('RoomRates', { hotelId, roomType: r.roomType, occupancy: r.occupancy, season: r.season }))[0] as any
      if (existing) await this.orm.update('RoomRates', existing.id, { basePrice, percentage, price, closed })
      else await this.orm.create('RoomRates', { id: crypto.randomUUID(), hotelId, roomType: r.roomType, occupancy: r.occupancy, season: r.season, basePrice, percentage, price, closed })
      saved++
    }
    return saved
  }

  async copyRatesNextYear(hotelId: string): Promise<{ copied: number; total: number }> {
    const rates = await this.orm.findMany('RoomRates', { hotelId }) as any[]
    let copied = 0
    for (const r of rates) {
      const nextYear = String(r.season || '').replace(/\d{4}/, String(new Date().getFullYear() + 1))
      const exists = (await this.orm.findMany('RoomRates', { hotelId, roomType: r.roomType, occupancy: r.occupancy, season: nextYear }))[0]
      if (!exists) { await this.orm.create('RoomRates', { id: crypto.randomUUID(), hotelId, roomType: r.roomType, occupancy: r.occupancy, season: nextYear, price: r.price, basePrice: r.basePrice, percentage: r.percentage }); copied++ }
    }
    return { copied, total: rates.length }
  }

  async listBlocks(hotelId: string, startDate?: string, endDate?: string): Promise<any[]> {
    let data = await this.orm.findMany('RoomBlocks', { hotelId }) as any[]
    if (startDate && endDate) data = data.filter((b: any) => b.startDate <= endDate && b.endDate >= startDate)
    return data
  }

  async createBlocks(hotelId: string, userId: string, roomIds: string[], reason: string, startDate: string, endDate: string): Promise<any[]> {
    const created: any[] = []
    for (const roomId of roomIds) {
      created.push(await this.orm.create('RoomBlocks', { id: crypto.randomUUID(), hotelId, roomId, reason: reason || '', startDate, endDate, createdBy: userId }))
    }
    return created
  }

  async deleteBlock(id: string): Promise<void> {
    await this.orm.delete('RoomBlocks', id)
  }

  async listRateRestrictions(hotelId: string): Promise<any[]> {
    return await this.orm.findMany('RateRestrictions', { hotelId }) as any[]
  }

  async updateRateRestrictions(hotelId: string, restrictions: any[]): Promise<number> {
    let saved = 0
    for (const r of restrictions) {
      if (!r.roomType || !r.season) continue
      const existing = (await this.orm.findMany('RateRestrictions', { hotelId, roomType: r.roomType, season: r.season }))[0] as any
      if (existing) {
        await this.orm.update('RateRestrictions', existing.id, { minStay: r.minStay ?? 0, maxStay: r.maxStay ?? 0, cta: r.cta ?? 0, ctd: r.ctd ?? 0, closedToArrival: r.closedToArrival ?? 0, closedToDeparture: r.closedToDeparture ?? 0 })
      } else {
        await this.orm.create('RateRestrictions', { id: crypto.randomUUID(), hotelId, roomType: r.roomType, season: r.season, minStay: r.minStay ?? 0, maxStay: r.maxStay ?? 0, cta: r.cta ?? 0, ctd: r.ctd ?? 0, closedToArrival: r.closedToArrival ?? 0, closedToDeparture: r.closedToDeparture ?? 0 })
      }
      saved++
    }
    return saved
  }

  async getChannelMetrics(hotelId: string): Promise<any[]> {
    const reservations = await this.orm.findMany('Reservations', { hotelId }) as any[]
    const rooms = await this.orm.findMany('Rooms', { hotelId }) as any[]
    const byChannel: Record<string, { count: number; revenue: number; nights: number }> = {}
    for (const r of reservations) {
      const ch = r.channel || 'direct'
      if (!byChannel[ch]) byChannel[ch] = { count: 0, revenue: 0, nights: 0 }
      byChannel[ch].count++; byChannel[ch].revenue += r.totalAmount || 0
      const ci = new Date(String(r.checkIn).slice(0, 10)).getTime()
      const co = new Date(String(r.checkOut).slice(0, 10)).getTime()
      byChannel[ch].nights += co > ci ? Math.round((co - ci) / 86400000) : 0
    }
    return Object.entries(byChannel).map(([channel, data]) => ({
      channel, bookings: data.count, revenue: data.revenue,
      adr: data.nights > 0 ? Math.round(data.revenue / data.nights) : 0,
      revpar: rooms.length > 0 ? Math.round(data.revenue / rooms.length) : 0,
      avgStay: data.count > 0 ? (data.nights / data.count).toFixed(1) : '0',
    }))
  }
}
