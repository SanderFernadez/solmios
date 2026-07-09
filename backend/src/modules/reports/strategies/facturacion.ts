import type { ReportStrategy, ReportContext } from './types'
import { bucketByDay } from '../helpers'
import { sumCollected, sumExpenses } from '../usecases/money'

export class FacturacionStrategy implements ReportStrategy {
  readonly type = 'facturacion'

  execute(ctx: ReportContext) {
    const roomRevenue = ctx.reservations.reduce((s: number, r: any) => s + (r.totalAmount || 0), 0)
    const reservationIds = new Set(ctx.reservations.map((r: any) => r.id))
    const charges = ctx.folioCharges.filter((c: any) => reservationIds.has(c.reservationId))
    const extrasRevenue = charges.filter((c: any) => c.category !== 'room' && c.createdAt >= ctx.from).reduce((s: number, c: any) => s + (c.amount * (c.quantity || 1)), 0)
    const commissionOTA = ctx.reservations.reduce((s: number, r: any) => s + (r.commissionAmount || 0), 0)
    const taxes = Math.round(roomRevenue * ctx.taxRate)

    // Devengado: lo que el hotel tiene derecho a cobrar en el período.
    const facturado = roomRevenue + extrasRevenue
    // Cobrado: lo que realmente entró, leído de `payments`. Puede diferir del devengado y está bien.
    const ingresado = sumCollected(ctx.payments)
    // Negativo = el huésped prepagó estadías futuras. Es información, no un error.
    const porCobrar = facturado - ingresado

    const gastos = sumExpenses(ctx.expenses)
    const net = facturado - taxes - commissionOTA

    return {
      type: this.type, from: ctx.from, to: ctx.to,
      roomRevenue, extrasRevenue,
      extrasByCategory: charges.reduce((a: any, c: any) => { if (c.category === 'room') return a; a[c.category] = (a[c.category] || 0) + c.amount * (c.quantity || 1); return a }, {}),
      taxes, commissionOTA, total: facturado, net,
      facturado, ingresado, porCobrar,
      gastos, resultado: net - gastos,
      daily: bucketByDay(ctx.reservations, ctx.from, ctx.to, (r: any) => r.totalAmount || 0),
    }
  }
}
