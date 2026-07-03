import type { ReportStrategy, ReportContext } from './types'
import { bucketByDay } from '../helpers'

export class FacturacionStrategy implements ReportStrategy {
  readonly type = 'facturacion'

  execute(ctx: ReportContext) {
    const roomRevenue = ctx.reservations.reduce((s: number, r: any) => s + (r.totalAmount || 0), 0)
    const reservationIds = new Set(ctx.reservations.map((r: any) => r.id))
    const charges = ctx.folioCharges.filter((c: any) => reservationIds.has(c.reservationId))
    const extrasRevenue = charges.filter((c: any) => c.category !== 'room' && c.createdAt >= ctx.from).reduce((s: number, c: any) => s + (c.amount * (c.quantity || 1)), 0)
    const commissionOTA = ctx.reservations.reduce((s: number, r: any) => s + (r.commissionAmount || 0), 0)
    const taxes = Math.round(roomRevenue * ctx.taxRate)
    return {
      type: this.type, from: ctx.from, to: ctx.to,
      roomRevenue, extrasRevenue,
      extrasByCategory: charges.reduce((a: any, c: any) => { if (c.category === 'room') return a; a[c.category] = (a[c.category] || 0) + c.amount * (c.quantity || 1); return a }, {}),
      taxes, commissionOTA, total: roomRevenue + extrasRevenue,
      net: roomRevenue + extrasRevenue - taxes - commissionOTA,
      daily: bucketByDay(ctx.reservations, ctx.from, ctx.to, (r: any) => r.totalAmount || 0),
    }
  }
}
