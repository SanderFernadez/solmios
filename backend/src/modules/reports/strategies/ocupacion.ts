import type { ReportStrategy, ReportContext } from './types'
import { eachDay } from '../helpers'

export class OcupacionStrategy implements ReportStrategy {
  readonly type = 'ocupacion'

  execute(ctx: ReportContext) {
    const days = eachDay(ctx.from, ctx.to)
    const dailyOccupancy = days.map(date => {
      const active = ctx.reservations.filter((r: any) => { const ci = String(r.checkIn || '').slice(0, 10); const co = String(r.checkOut || '').slice(0, 10); return ci <= date && co > date && r.status !== 'cancelled' }).length
      const blocked = ctx.blocks.filter((b: any) => b.startDate <= date && b.endDate >= date).length
      return { date, occupied: active, blocked, free: Math.max(0, ctx.totalRooms - active - blocked), realOccupiedPct: ctx.totalRooms ? Math.round((active / ctx.totalRooms) * 100) : 0, totalPct: ctx.totalRooms ? Math.round(((active + blocked) / ctx.totalRooms) * 100) : 0 }
    })
    const avgReal = Math.round(dailyOccupancy.reduce((s, d) => s + d.realOccupiedPct, 0) / (dailyOccupancy.length || 1))
    return {
      type: this.type, from: ctx.from, to: ctx.to, totalRooms: ctx.totalRooms,
      avgRealOccupancy: avgReal, daily: dailyOccupancy,
      byRoomType: ctx.rooms.reduce((a: any, r: any) => { a[r.type] = (a[r.type] || 0) + 1; return a }, {}),
    }
  }
}
