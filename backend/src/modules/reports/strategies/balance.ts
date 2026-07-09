// reports/strategies/balance.ts — Estado de resultados del hotel, en base caja.
//
// `resultado = ingresosCobrados - egresosPagados`. Las dos patas son plata que se movió de verdad,
// así que el balance cuadra contra Caja y contra la conciliación bancaria.
//
// Mezclar cobrado con devengado daría un número que no cuadra con ninguna de las dos cosas. Por eso
// el devengado (`facturado`) y el gasto todavía impago (`egresosPendientes`) se reportan APARTE:
// son compromisos, no plata movida.
//
// Los ingresos NO se abren por concepto (habitación vs extras): un `payment` registra un monto y un
// método, no qué consumo saldó. Abrirlo sería inventarlo. El desglose por concepto vive en el
// devengado, que sí lo sabe.

import type { ReportStrategy, ReportContext } from './types'
import { sumCollected, collectedByMethod, sumExpenses, sumByCategory, isPaid } from '../usecases/money'

export class BalanceStrategy implements ReportStrategy {
  readonly type = 'balance'

  execute(ctx: ReportContext) {
    const ingresosCobrados = sumCollected(ctx.payments)
    const ingresosPorMetodo = collectedByMethod(ctx.payments)

    const pagados = ctx.expenses.filter(isPaid)
    const egresosPagados = sumExpenses(pagados)
    const egresosPorCategoria = sumByCategory(pagados)
    const egresosPendientes = sumExpenses(ctx.expenses.filter((e: any) => !isPaid(e)))

    // Devengado, solo como referencia: lo que el hotel tiene derecho a cobrar en el período.
    const roomRevenue = ctx.reservations.reduce((s: number, r: any) => s + (r.totalAmount || 0), 0)
    const reservationIds = new Set(ctx.reservations.map((r: any) => r.id))
    const extrasRevenue = ctx.folioCharges
      .filter((c: any) => reservationIds.has(c.reservationId) && c.category !== 'room' && c.kind !== 'payment')
      .reduce((s: number, c: any) => s + Number(c.amount || 0) * Number(c.quantity || 1), 0)
    const facturado = roomRevenue + extrasRevenue

    return {
      type: this.type, from: ctx.from, to: ctx.to,
      ingresosCobrados, ingresosPorMetodo,
      egresosPagados, egresosPorCategoria, egresosPendientes,
      resultado: ingresosCobrados - egresosPagados,
      facturado,
      // Negativo = se cobró más de lo devengado (prepagos de estadías futuras).
      porCobrar: facturado - ingresosCobrados,
    }
  }
}
