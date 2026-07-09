// reports/tests/money.test.ts — Lectura del dinero para reportes.
//
// Regresión: los reportes sumaban `Reservations.totalAmount` (devengado) y lo mostraban como
// ingreso, así que nunca cuadraban contra caja ni contra la conciliación. Y los gastos se cargaban
// del período pero se sumaba la tabla entera.

import { describe, it, expect } from 'bun:test'
import {
  inDateRange, paymentDate, expenseDate, sumCollected, sumCharged, sumRefunded, sumExpenses,
  chargeTotal, isConsumption, collectedByMethod, isPaid, sumByCategory,
} from '../usecases/money'

const charge = (over: any = {}) => ({ type: 'charge', status: 'completed', amount: 100, ...over })

describe('sumCollected — dinero que realmente entró', () => {
  it('suma los cargos completados', () => {
    expect(sumCollected([charge({ amount: 100 }), charge({ amount: 50 })])).toBe(150)
  })

  it('resta las devoluciones completadas', () => {
    expect(sumCollected([charge({ amount: 100 }), charge({ type: 'refund', amount: 30 })])).toBe(70)
  })

  it('ignora los pagos que no se completaron', () => {
    expect(sumCollected([charge({ status: 'pending' }), charge({ status: 'failed' })])).toBe(0)
  })

  // Un depósito en garantía sigue siendo plata del huésped: contarlo infla los ingresos y
  // descuadra cuando se devuelve.
  it('no cuenta depósitos en garantía ni retiros como ingreso', () => {
    expect(sumCollected([charge({ type: 'deposit', amount: 500 }), charge({ type: 'withdrawal', amount: 200 })])).toBe(0)
  })

  // Restar el crudo sumaría la devolución en vez de restarla.
  it('resta la devolución aunque el monto venga negativo', () => {
    expect(sumCollected([charge({ amount: 100 }), charge({ type: 'refund', amount: -30 })])).toBe(70)
  })
})

describe('sumCharged / sumRefunded — brutos, para vistas de dos líneas', () => {
  it('sumCharged no resta las devoluciones', () => {
    expect(sumCharged([charge({ amount: 100 }), charge({ type: 'refund', amount: 30 })])).toBe(100)
  })

  it('sumRefunded devuelve un positivo, aunque el monto venga negativo', () => {
    expect(sumRefunded([charge({ type: 'refund', amount: -30 }), charge({ type: 'refund', amount: 20 })])).toBe(50)
  })

  it('juntos no cuentan la devolución dos veces', () => {
    const rows = [charge({ amount: 100 }), charge({ type: 'refund', amount: 30 })]
    expect(sumCharged(rows) - sumRefunded(rows)).toBe(sumCollected(rows))
  })

  it('la identidad se mantiene con montos de devolución negativos', () => {
    const rows = [charge({ amount: 100 }), charge({ type: 'refund', amount: -30 })]
    expect(sumCharged(rows) - sumRefunded(rows)).toBe(sumCollected(rows))
  })
})

describe('collectedByMethod', () => {
  it('agrupa lo cobrado por método', () => {
    const r = collectedByMethod([charge({ method: 'cash', amount: 100 }), charge({ method: 'link', amount: 50 })])
    expect(r).toEqual({ cash: 100, link: 50 })
  })

  it('la devolución descuenta del método por el que se cobró', () => {
    const r = collectedByMethod([charge({ method: 'card', amount: 100 }), charge({ method: 'card', type: 'refund', amount: 30 })])
    expect(r).toEqual({ card: 70 })
  })

  it('un pago sin método cae en `other`', () => {
    expect(collectedByMethod([charge({ method: undefined, amount: 10 })])).toEqual({ other: 10 })
  })

  it('los pagos no completados no suman', () => {
    expect(collectedByMethod([charge({ method: 'cash', status: 'pending' })])).toEqual({})
  })
})

describe('isPaid / sumByCategory', () => {
  it('un gasto solo sale de la plata cuando está pagado', () => {
    expect(isPaid({ paid: 1 })).toBe(true)
    expect(isPaid({ paid: 0 })).toBe(false)
    expect(isPaid({})).toBe(false)
  })

  it('agrupa los gastos por categoría, con `general` por defecto', () => {
    const r = sumByCategory([{ amount: 100, category: 'supplies' }, { amount: 50 }, { amount: 20, category: 'supplies' }])
    expect(r).toEqual({ supplies: 120, general: 50 })
  })
})

describe('inDateRange', () => {
  const rows = [{ d: '2026-01-01' }, { d: '2026-07-09T18:30:00Z' }, { d: '2026-12-31T23:59:00Z' }]
  const dateOf = (r: any) => r.d

  it('incluye los bordes, comparando por día', () => {
    expect(inDateRange(rows, '2026-01-01', '2026-12-31', dateOf)).toHaveLength(3)
  })

  it('excluye lo que queda fuera', () => {
    expect(inDateRange(rows, '2026-07-01', '2026-07-31', dateOf)).toHaveLength(1)
  })

  it('descarta filas sin fecha en vez de contarlas', () => {
    expect(inDateRange([{ d: undefined }], '2026-01-01', '2026-12-31', dateOf)).toHaveLength(0)
  })
})

describe('paymentDate / expenseDate', () => {
  it('el pago se imputa a cuando se procesó, no a cuando se creó', () => {
    expect(paymentDate({ processedAt: '2026-07-09', createdAt: '2026-01-01' })).toBe('2026-07-09')
    expect(paymentDate({ createdAt: '2026-01-01' })).toBe('2026-01-01')
  })

  it('el gasto se imputa a la fecha en que ocurrió, no a la de carga', () => {
    expect(expenseDate({ date: '2026-07-01', createdAt: '2026-07-09' })).toBe('2026-07-01')
    expect(expenseDate({ createdAt: '2026-07-09' })).toBe('2026-07-09')
  })
})

describe('chargeTotal / isConsumption', () => {
  it('multiplica por la cantidad', () => {
    expect(chargeTotal({ amount: 25, quantity: 4 })).toBe(100)
    expect(chargeTotal({ amount: 25 })).toBe(25)
  })

  // Un `kind: 'payment'` en el folio no es consumo: es el pago que baja el saldo.
  it('el pago del folio no es consumo', () => {
    expect(isConsumption({ kind: 'payment' })).toBe(false)
    expect(isConsumption({ kind: 'charge' })).toBe(true)
  })
})

describe('sumExpenses', () => {
  it('suma los importes', () => {
    expect(sumExpenses([{ amount: 100 }, { amount: 50.5 }])).toBe(150.5)
  })

  it('tolera importes ausentes', () => {
    expect(sumExpenses([{ amount: undefined }, { amount: 10 }])).toBe(10)
  })
})
