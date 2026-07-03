import type { ReportStrategy, ReportContext } from './types'
import { eachDay } from '../helpers'

export class PernoctacionesStrategy implements ReportStrategy {
  readonly type = 'pernoctaciones'

  execute(ctx: ReportContext) {
    const days = eachDay(ctx.from, ctx.to)
    const daily = days.map(date => {
      const inHouse = ctx.reservations.filter((r: any) => { const ci = String(r.checkIn || '').slice(0, 10); const co = String(r.checkOut || '').slice(0, 10); return ci <= date && co > date && r.status !== 'cancelled' })
      const adults = inHouse.reduce((s: number, r: any) => s + (r.adults || 0), 0)
      const children = inHouse.reduce((s: number, r: any) => s + (r.children || 0), 0)
      return { date, adults, children, total: adults + children, reservations: inHouse.length }
    })
    const totalPaxes = daily.reduce((s, d) => s + d.total, 0)
    return {
      type: this.type, from: ctx.from, to: ctx.to,
      totalPaxes, totalAdults: daily.reduce((s, d) => s + d.adults, 0),
      totalChildren: daily.reduce((s, d) => s + d.children, 0),
      avgPerNight: daily.length ? Math.round(totalPaxes / daily.length) : 0, daily,
    }
  }
}
