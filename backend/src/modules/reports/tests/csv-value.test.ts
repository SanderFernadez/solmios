// reports/tests/csv-value.test.ts — G6: CSV/Formula injection en el export.

import { describe, it, expect } from 'bun:test'
import { csvValue } from '../helpers'

describe('csvValue — CSV/Formula injection (G6)', () => {
  it('neutraliza celdas que empiezan con = + - @ (fórmulas de Excel)', () => {
    expect(csvValue('=cmd|calc')).toBe(`'=cmd|calc`)  // prefijado con '; sin coma/comilla no se envuelve
    expect(csvValue('=SUM(A1)')).toBe(`'=SUM(A1)`)
    expect(csvValue('+1')).toBe(`'+1`)
    expect(csvValue('-2')).toBe(`'-2`)
    expect(csvValue('@ref')).toBe(`'@ref`)
  })

  it('un valor peligroso NUNCA queda empezando con un caracter de fórmula', () => {
    for (const v of ['=HYPERLINK("http://x")', '+cmd', '-2+3', '@import']) {
      expect(csvValue(v).replace(/^"/, '')).toMatch(/^'/)
    }
  })

  it('valores normales quedan intactos', () => {
    expect(csvValue('Juan Perez')).toBe('Juan Perez')
    expect(csvValue(1240)).toBe('1240')
  })

  it('sigue escapando comas y comillas del formato CSV', () => {
    expect(csvValue('con,coma')).toBe('"con,coma"')
    expect(csvValue('di"jo')).toBe('"di""jo"')  // la comilla obliga a envolver la celda
  })

  it('null/undefined → celda vacía', () => {
    expect(csvValue(null)).toBe('')
    expect(csvValue(undefined)).toBe('')
  })
})
