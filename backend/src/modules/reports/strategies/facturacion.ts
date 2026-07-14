import type { ReportStrategy, ReportContext } from './types'
import { bucketByDay } from '../helpers'
import { sumCollected, sumExpenses } from '../usecases/money'

export class FacturacionStrategy implements ReportStrategy {
  readonly type = 'facturacion'

  execute(ctx: ReportContext) {
    // revenueReservations excluye cancelled/no_show (nunca fueron plata).
    const roomRevenue = ctx.revenueReservations.reduce((s: number, r: any) => s + (r.totalAmount || 0), 0)
    const reservationIds = new Set(ctx.revenueReservations.map((r: any) => r.id))
    // El cargo se vincula a la reserva por su folio, NO por c.reservationId (columna que no existe
    // en folio_charges → antes daba undefined y TODOS los extras quedaban fuera del facturado).
    const charges = ctx.folioCharges.filter((c: any) => reservationIds.has(ctx.folioToReservation.get(c.folioId)) && c.kind !== 'payment')
    const extrasRevenue = charges.filter((c: any) => c.category !== 'room' && c.createdAt >= ctx.from).reduce((s: number, c: any) => s + (c.amount * (c.quantity || 1)), 0)
    const commissionOTA = ctx.revenueReservations.reduce((s: number, r: any) => s + (r.commissionAmount || 0), 0)
    const taxes = Math.round(roomRevenue * ctx.taxRate)

    // Devengado: lo que el hotel tiene derecho a cobrar en el período.
    const facturado = roomRevenue + extrasRevenue
    // Cobrado: lo que realmente entró, leído de `payments`. Puede diferir del devengado y está bien.
    const ingresado = sumCollected(ctx.payments)
    // Negativo = el huésped prepagó estadías futuras. Es información, no un error.
    const porCobrar = facturado - ingresado

    // Devengado: TODOS los gastos del período, pagados o no. El reporte `balance` cuenta solo los
    // pagados, porque trabaja en base caja. La diferencia entre ambos es `egresosPendientes`.
    const gastos = sumExpenses(ctx.expenses)
    const net = facturado - taxes - commissionOTA

    return {
      type: this.type, from: ctx.from, to: ctx.to,
      roomRevenue, extrasRevenue,
      extrasByCategory: charges.reduce((a: any, c: any) => { if (c.category === 'room') return a; a[c.category] = (a[c.category] || 0) + c.amount * (c.quantity || 1); return a }, {}),
      taxes, commissionOTA, total: facturado, net,
      facturado, ingresado, porCobrar,
      gastos, resultado: net - gastos,
      daily: bucketByDay(ctx.revenueReservations, ctx.from, ctx.to, (r: any) => r.totalAmount || 0),
    }
  }
}
