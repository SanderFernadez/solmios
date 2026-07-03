import type { ReportStrategy, ReportContext } from './types'
import { nightsBetween, eachDay } from '../helpers'

export class RendimientoStrategy implements ReportStrategy {
  readonly type = 'rendimiento'

  execute(ctx: ReportContext) {
    const nightsSold = ctx.reservations.reduce((s: number, r: any) => s + nightsBetween(r.checkIn, r.checkOut), 0)
    const revenue = ctx.reservations.reduce((s: number, r: any) => s + (r.totalAmount || 0), 0)
    const adr = nightsSold > 0 ? Math.round(revenue / nightsSold) : 0
    const days = eachDay(ctx.from, ctx.to).length
    const availableRoomNights = ctx.totalRooms * days
    const revpar = availableRoomNights > 0 ? Math.round(revenue / availableRoomNights) : 0
    const occupancyPct = availableRoomNights > 0 ? Math.round((nightsSold / availableRoomNights) * 100) : 0
    const avgStay = ctx.reservations.length ? (nightsSold / ctx.reservations.length).toFixed(1) : '0'
    const roomById = new Map(ctx.rooms.map((r: any) => [r.id, r]))
    const adrByType: Record<string, { nights: number; revenue: number; adr: number }> = {}
    for (const r of ctx.reservations) { const rm = roomById.get(r.roomId); const t = rm?.type || 'unknown'; const n = nightsBetween(r.checkIn, r.checkOut); if (!adrByType[t]) adrByType[t] = { nights: 0, revenue: 0, adr: 0 }; adrByType[t].nights += n; adrByType[t].revenue += r.totalAmount || 0 }
    for (const k of Object.keys(adrByType)) { const t = adrByType[k]; t.adr = t.nights > 0 ? Math.round(t.revenue / t.nights) : 0 }
    return {
      type: this.type, from: ctx.from, to: ctx.to,
      adr, revpar, occupancyPct, avgStay: Number(avgStay),
      nightsSold, availableRoomNights, adrByType,
      revenueByType: Object.fromEntries(Object.entries(adrByType).map(([k, v]) => [k, v.revenue])),
    }
  }
}
