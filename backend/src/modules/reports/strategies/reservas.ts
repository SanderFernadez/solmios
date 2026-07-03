import type { ReportStrategy, ReportContext } from './types'
import { bucketByDay } from '../helpers'

export class ReservasStrategy implements ReportStrategy {
  readonly type = 'reservas'

  execute(ctx: ReportContext) {
    const byStatus = ctx.reservations.reduce((a: any, r: any) => { a[r.status || 'pending'] = (a[r.status || 'pending'] || 0) + 1; return a }, {})
    const byChannel = ctx.reservations.reduce((a: any, r: any) => { const c = r.channel || 'direct'; a[c] = (a[c] || 0) + 1; return a }, {})
    const ota = ctx.reservations.filter((r: any) => r.channel && r.channel !== 'direct' && r.channel !== 'whatsapp' && r.channel !== 'phone').length
    const direct = ctx.reservations.length - ota
    const cancelled = ctx.reservations.filter((r: any) => r.status === 'cancelled').length
    const noShow = ctx.reservations.filter((r: any) => r.status === 'no_show').length
    return {
      type: this.type, from: ctx.from, to: ctx.to,
      total: ctx.reservations.length, byStatus, byChannel,
      otaVsDirect: { ota, direct, otaPct: ctx.reservations.length ? Math.round((ota / ctx.reservations.length) * 100) : 0, directPct: ctx.reservations.length ? Math.round((direct / ctx.reservations.length) * 100) : 0 },
      cancelled, noShow, cancellationRate: ctx.reservations.length ? Math.round((cancelled / ctx.reservations.length) * 100) : 0,
      dailyCreated: bucketByDay(ctx.reservations, ctx.from, ctx.to, () => 1),
    }
  }
}
