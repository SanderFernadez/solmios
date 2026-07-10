// shared/tests/date-range.test.ts — El rango de fechas en memoria y el filtro anti-objeto.

import { describe, it, expect } from 'bun:test'
import { inDateRange, toDay, equalityOnly } from '../usecases/date-range'

const rec = (date: string, id = 'x') => ({ date, id })

describe('toDay', () => {
  it('recorta un timestamp ISO al día', () => {
    expect(toDay('2026-07-10T14:30:00.000Z')).toBe('2026-07-10')
    expect(toDay('2026-07-10')).toBe('2026-07-10')
    expect(toDay('')).toBe('')
  })
})

describe('inDateRange', () => {
  const rows = [rec('2026-07-08'), rec('2026-07-10'), rec('2026-07-12'), rec('2026-07-15')]

  it('sin from ni to devuelve todo', () => {
    expect(inDateRange(rows, 'date')).toHaveLength(4)
  })

  it('filtra por ambos extremos, inclusive', () => {
    const out = inDateRange(rows, 'date', '2026-07-10', '2026-07-12')
    expect(out.map((r) => r.date)).toEqual(['2026-07-10', '2026-07-12'])
  })

  it('incluye lo ocurrido el mismo día de `to`, aunque tenga hora', () => {
    const withTime = [rec('2026-07-10T23:59:00.000Z')]
    // Con comparación por instante, `to='2026-07-10'` (≈00:00) dejaría esto afuera.
    expect(inDateRange(withTime, 'date', '2026-07-01', '2026-07-10')).toHaveLength(1)
  })

  it('acepta solo from o solo to', () => {
    expect(inDateRange(rows, 'date', '2026-07-12').map((r) => r.date)).toEqual(['2026-07-12', '2026-07-15'])
    expect(inDateRange(rows, 'date', undefined, '2026-07-10').map((r) => r.date)).toEqual(['2026-07-08', '2026-07-10'])
  })

  it('descarta filas con la fecha vacía cuando hay rango', () => {
    expect(inDateRange([rec('')], 'date', '2026-07-01', '2026-07-31')).toHaveLength(0)
  })
})

describe('equalityOnly', () => {
  it('elimina valores objeto (los que el ORM no sabe bindear)', () => {
    const out = equalityOnly({ hotelId: 'h1', date: { $gte: '2026-07-01' }, active: 1 })
    expect(out).toEqual({ hotelId: 'h1', active: 1 })
  })

  it('elimina undefined pero conserva 0 y cadena vacía', () => {
    expect(equalityOnly({ a: undefined, b: 0, c: '' })).toEqual({ b: 0, c: '' })
  })
})
