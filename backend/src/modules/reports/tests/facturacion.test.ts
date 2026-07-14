// reports/tests/facturacion.test.ts — Devengado vs cobrado, y gastos en el reporte.
//
// Regresión: `ctx.expenses` se cargaba de la base y ninguna estrategia lo leía, así que los gastos
// no aparecían en ningún reporte. Y solo se reportaba el devengado, nunca lo cobrado.

import { describe, it, expect } from 'bun:test'
import { FacturacionStrategy } from '../strategies/facturacion'
import type { ReportContext } from '../strategies/types'

function ctx(over: Partial<ReportContext> = {}): ReportContext {
  const base = {
    from: '2026-07-01', to: '2026-07-31',
    totalRooms: 10, taxRate: 0,
    reservations: [] as any[], rooms: [], guests: [],
    expenses: [], payments: [], folioCharges: [], folios: [] as any[], blocks: [], hotel: {},
    ...over,
  }
  // Derivados igual que report-queries.ts, salvo que el test los fije explícito.
  const revenueReservations = over.revenueReservations
    ?? base.reservations.filter((r: any) => r.status !== 'cancelled' && r.status !== 'no_show')
  const folioToReservation = over.folioToReservation
    ?? new Map<string, string>(base.folios.filter((f: any) => f.reservationId).map((f: any) => [f.id, f.reservationId]))
  return { ...base, revenueReservations, folioToReservation }
}

const reserva = (totalAmount: number, over: any = {}) => ({ id: 'r1', totalAmount, checkIn: '2026-07-05', ...over })
const pago = (amount: number, over: any = {}) => ({ type: 'charge', status: 'completed', amount, ...over })

const strategy = new FacturacionStrategy()

describe('FacturacionStrategy — devengado vs cobrado', () => {
  it('separa lo facturado de lo ingresado', () => {
    const r = strategy.execute(ctx({
      reservations: [reserva(12400)],
      payments: [pago(9850)],
    }))

    expect(r.facturado).toBe(12400)
    expect(r.ingresado).toBe(9850)
    expect(r.porCobrar).toBe(2550)
  })

  it('`total` sigue siendo el devengado, para no romper la vista existente', () => {
    const r = strategy.execute(ctx({ reservations: [reserva(1000)], payments: [pago(400)] }))

    expect(r.total).toBe(1000)
    expect(r.total).toBe(r.facturado)
  })

  // Un huésped que prepaga una estadía futura cobra más de lo devengado en el período. No es un bug.
  it('porCobrar negativo cuando se cobró más de lo devengado', () => {
    const r = strategy.execute(ctx({ reservations: [reserva(500)], payments: [pago(800)] }))

    expect(r.porCobrar).toBe(-300)
  })

  it('lo cobrado descuenta las devoluciones', () => {
    const r = strategy.execute(ctx({
      reservations: [reserva(1000)],
      payments: [pago(1000), pago(200, { type: 'refund' })],
    }))

    expect(r.ingresado).toBe(800)
  })

  it('un pago pendiente no cuenta como ingresado', () => {
    const r = strategy.execute(ctx({ reservations: [reserva(1000)], payments: [pago(1000, { status: 'pending' })] }))

    expect(r.ingresado).toBe(0)
    expect(r.porCobrar).toBe(1000)
  })
})

describe('FacturacionStrategy — gastos', () => {
  it('suma los gastos del período y los resta del resultado', () => {
    const r = strategy.execute(ctx({
      reservations: [reserva(1000)],
      expenses: [{ amount: 200 }, { amount: 50 }],
    }))

    expect(r.gastos).toBe(250)
    expect(r.net).toBe(1000)
    expect(r.resultado).toBe(750)
  })

  it('sin gastos, el resultado iguala al neto', () => {
    const r = strategy.execute(ctx({ reservations: [reserva(1000)] }))

    expect(r.gastos).toBe(0)
    expect(r.resultado).toBe(r.net)
  })

  it('el neto descuenta impuestos y comisión OTA antes que los gastos', () => {
    const r = strategy.execute(ctx({
      reservations: [reserva(1000, { commissionAmount: 100 })],
      taxRate: 0.1,
      expenses: [{ amount: 50 }],
    }))

    expect(r.taxes).toBe(100)
    expect(r.commissionOTA).toBe(100)
    expect(r.net).toBe(800)
    expect(r.resultado).toBe(750)
  })
})
