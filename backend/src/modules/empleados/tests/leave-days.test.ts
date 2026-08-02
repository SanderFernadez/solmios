// empleados/tests/leave-days.test.ts — countLeaveDays con festivos + días laborables (#602).
//
// #188 computa `days` desde el rango start→end descontando festivos.
// #602 agrega el filtro de días laborables: si el hotel configura [1,2,3,4,5] (Lun-Vie),
// sábados (6) y domingos (0) se descuentan además de los festivos.

import { describe, it, expect } from 'bun:test'
import { countLeaveDays } from '../usecases/leave-config'

// 2026-03-01 es domingo (getUTCDay()=0). La semana completa Dom→Sáb:
//   Dom 1, Lun 2, Mar 3, Mié 4, Jue 5, Vie 6, Sáb 7.
const WEEK_START = '2026-03-01'
const WEEK_END = '2026-03-07'
const NO_HOLIDAYS = new Set<string>()
const NO_RECURRING = new Set<string>()

describe('countLeaveDays — días laborables (#602)', () => {
  it('cuenta todos los días cuando workingDays es undefined (comportamiento por defecto)', () => {
    expect(countLeaveDays(WEEK_START, WEEK_END, NO_HOLIDAYS, NO_RECURRING)).toBe(7)
  })

  it('cuenta todos los días cuando workingDays es array vacío', () => {
    expect(countLeaveDays(WEEK_START, WEEK_END, NO_HOLIDAYS, NO_RECURRING, [])).toBe(7)
  })

  it('filtra domingos y sábados con workingDays=[1,2,3,4,5] (Lun-Vie)', () => {
    // 7 días - 1 dom - 1 sáb = 5
    expect(countLeaveDays(WEEK_START, WEEK_END, NO_HOLIDAYS, NO_RECURRING, [1, 2, 3, 4, 5])).toBe(5)
  })

  it('filtra solo domingos con workingDays=[1,2,3,4,5,6]', () => {
    // 7 días - 1 dom = 6
    expect(countLeaveDays(WEEK_START, WEEK_END, NO_HOLIDAYS, NO_RECURRING, [1, 2, 3, 4, 5, 6])).toBe(6)
  })

  it('combina filtro de días laborables con festivos sin doble conteo', () => {
    // Feriado el martes 3 (exacto) + workingDays L-V: 7 - 1 dom - 1 sáb - 1 festivo = 4
    const exact = new Set(['2026-03-03'])
    expect(countLeaveDays(WEEK_START, WEEK_END, exact, NO_RECURRING, [1, 2, 3, 4, 5])).toBe(4)
  })

  it('combina festivo recurrente + días laborables', () => {
    // Feriado recurrente 03-04 (miércoles) + workingDays L-V: 7 - 1 dom - 1 sáb - 1 festivo = 4
    const recurring = new Set(['03-04'])
    expect(countLeaveDays(WEEK_START, WEEK_END, NO_HOLIDAYS, recurring, [1, 2, 3, 4, 5])).toBe(4)
  })

  it('respeta el convenio 0=Domingo..6=Sábado (getUTCDay)', () => {
    // Solo domingos laborables → cuenta 1 (el día 1 de la semana de prueba)
    expect(countLeaveDays(WEEK_START, WEEK_END, NO_HOLIDAYS, NO_RECURRING, [0])).toBe(1)
    // Solo sábados → cuenta 1 (el día 7)
    expect(countLeaveDays(WEEK_START, WEEK_END, NO_HOLIDAYS, NO_RECURRING, [6])).toBe(1)
  })

  it('lanza ValidationError si tras filtrar todo el rango quedan 0 días', () => {
    // Rango de un solo domingo + workingDays L-V → 0 días.
    // countLeaveDays devuelve 0; el validador del usecase lo rechaza (testeado en leave-requests).
    expect(countLeaveDays('2026-03-01', '2026-03-01', NO_HOLIDAYS, NO_RECURRING, [1, 2, 3, 4, 5])).toBe(0)
  })
})
