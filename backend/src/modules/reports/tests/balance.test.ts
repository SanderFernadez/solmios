// reports/tests/balance.test.ts — Estado de resultados en base caja.
//
// La regla que sostiene todo: `resultado` solo suma plata que se movió. Un gasto impago o una
// reserva sin cobrar son compromisos, y se reportan aparte.

import { describe, it, expect } from 'bun:test'
import { BalanceStrategy } from '../strategies/balance'
import type { ReportContext } from '../strategies/types'

function ctx(over: Partial<ReportContext> = {}): ReportContext {
  const base = {
    from: '2026-07-01', to: '2026-07-31',
    totalRooms: 10, taxRate: 0,
    reservations: [] as any[], rooms: [], guests: [],
    expenses: [], payments: [], folioCharges: [], folios: [] as any[], blocks: [], hotel: {},
    ...over,
  }
  const revenueReservations = over.revenueReservations
    ?? base.reservations.filter((r: any) => r.status !== 'cancelled' && r.status !== 'no_show')
  const folioToReservation = over.folioToReservation
    ?? new Map<string, string>(base.folios.filter((f: any) => f.reservationId).map((f: any) => [f.id, f.reservationId]))
  return { ...base, revenueReservations, folioToReservation }
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

  it('los extras del folio suman al devengado, pero el pago del folio no (A3: link por folio)', () => {
    // El cargo se vincula a la reserva por su folio, NO por charge.reservationId (columna
    // inexistente en folio_charges). Sin folios que mapeen, los extras quedan fuera — que era el bug.
    const r = strategy.execute(ctx({
      reservations: [{ id: 'r1', totalAmount: 1000 }],
      folios: [{ id: 'f1', reservationId: 'r1' }],
      folioCharges: [
        { folioId: 'f1', category: 'minibar', amount: 50, quantity: 2, createdAt: '2026-07-15' },
        { folioId: 'f1', category: 'payment', kind: 'payment', amount: -300, quantity: 1 },
      ],
    }))

    expect(r.facturado).toBe(1100)  // 1000 room + 100 minibar; el pago -300 NO resta
  })

  it('los extras FUERA del rango [from, to] NO suman al devengado', () => {
    // BUG FIX: antes extrasRevenue no filtraba por fecha → un balance de julio sumaba extras de
    // toda la historia del hotel. Ahora se exige createdAt en [from, to].
    const r = strategy.execute(ctx({
      reservations: [{ id: 'r1', totalAmount: 1000 }],
      folios: [{ id: 'f1', reservationId: 'r1' }],
      folioCharges: [
        { folioId: 'f1', category: 'minibar', amount: 50, quantity: 2, createdAt: '2026-06-15' }, // antes de from
        { folioId: 'f1', category: 'spa', amount: 200, quantity: 1, createdAt: '2026-08-10' },     // después de to
      ],
    }))
    expect(r.facturado).toBe(1000) // solo room; ambos extras fuera de rango quedan excluidos
  })

  it('A1: una reserva cancelada no suma al facturado', () => {
    const r = strategy.execute(ctx({
      reservations: [
        { id: 'r1', totalAmount: 1000, status: 'checked_out' },
        { id: 'r2', totalAmount: 5000, status: 'cancelled' },
      ],
    }))
    expect(r.facturado).toBe(1000)  // la cancelada de 5000 no cuenta
  })
})
