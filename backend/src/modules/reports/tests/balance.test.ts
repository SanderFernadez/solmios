// reports/tests/balance.test.ts — Estado de resultados en base caja.
//
// La regla que sostiene todo: `resultado` solo suma plata que se movió. Un gasto impago o una
// reserva sin cobrar son compromisos, y se reportan aparte.

import { describe, it, expect } from 'bun:test'
import { BalanceStrategy } from '../strategies/balance'
import type { ReportContext } from '../strategies/types'

function ctx(over: Partial<ReportContext> = {}): ReportContext {
  return {
    from: '2026-07-01', to: '2026-07-31',
    totalRooms: 10, taxRate: 0,
    reservations: [], rooms: [], guests: [],
    expenses: [], payments: [], folioCharges: [], blocks: [], hotel: {},
    ...over,
  }
}

const pago = (amount: number, over: any = {}) => ({ type: 'charge', status: 'completed', method: 'cash', amount, ...over })
const gasto = (amount: number, over: any = {}) => ({ amount, paid: 1, category: 'general', ...over })

const strategy = new BalanceStrategy()

describe('BalanceStrategy — base caja', () => {
  it('resultado = cobrado menos gastos pagados', () => {
    const r = strategy.execute(ctx({
      payments: [pago(9850)],
      expenses: [gasto(2340)],
    }))

    expect(r.ingresosCobrados).toBe(9850)
    expect(r.egresosPagados).toBe(2340)
    expect(r.resultado).toBe(7510)
  })

  // Un gasto que todavía no se pagó no sacó plata de ningún lado.
  it('un gasto impago no afecta el resultado, pero se reporta', () => {
    const r = strategy.execute(ctx({
      payments: [pago(1000)],
      expenses: [gasto(100), gasto(500, { paid: 0 })],
    }))

    expect(r.egresosPagados).toBe(100)
    expect(r.egresosPendientes).toBe(500)
    expect(r.resultado).toBe(900)
  })

  it('un cobro pendiente no cuenta como ingreso', () => {
    const r = strategy.execute(ctx({ payments: [pago(1000, { status: 'pending' })] }))

    expect(r.ingresosCobrados).toBe(0)
    expect(r.resultado).toBe(0)
  })

  it('la devolución baja el resultado', () => {
    const r = strategy.execute(ctx({ payments: [pago(1000), pago(200, { type: 'refund' })] }))

    expect(r.ingresosCobrados).toBe(800)
    expect(r.resultado).toBe(800)
  })
})

describe('BalanceStrategy — desgloses', () => {
  it('abre los ingresos por método de pago', () => {
    const r = strategy.execute(ctx({
      payments: [pago(100, { method: 'cash' }), pago(250, { method: 'link' }), pago(50, { method: 'cash' })],
    }))

    expect(r.ingresosPorMetodo).toEqual({ cash: 150, link: 250 })
  })

  it('abre los egresos pagados por categoría, sin contar los impagos', () => {
    const r = strategy.execute(ctx({
      expenses: [gasto(890, { category: 'supplies' }), gasto(720, { category: 'utilities' }), gasto(999, { category: 'supplies', paid: 0 })],
    }))

    expect(r.egresosPorCategoria).toEqual({ supplies: 890, utilities: 720 })
  })
})

describe('BalanceStrategy — devengado como referencia', () => {
  it('reporta lo facturado y la brecha con lo cobrado, sin mezclarlo en el resultado', () => {
    const r = strategy.execute(ctx({
      reservations: [{ id: 'r1', totalAmount: 12400 }],
      payments: [pago(9850)],
      expenses: [gasto(2340)],
    }))

    expect(r.facturado).toBe(12400)
    expect(r.porCobrar).toBe(2550)
    // El resultado NO usa el devengado: es cobrado − pagado.
    expect(r.resultado).toBe(7510)
  })

  it('los extras del folio suman al devengado, pero el pago del folio no', () => {
    const r = strategy.execute(ctx({
      reservations: [{ id: 'r1', totalAmount: 1000 }],
      folioCharges: [
        { reservationId: 'r1', category: 'minibar', amount: 50, quantity: 2 },
        { reservationId: 'r1', category: 'payment', kind: 'payment', amount: -300, quantity: 1 },
      ],
    }))

    expect(r.facturado).toBe(1100)
  })
})
