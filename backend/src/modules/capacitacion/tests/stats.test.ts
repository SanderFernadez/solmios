// capacitacion/tests/stats.test.ts — DT-19: cursos completados por empleado en un período.
import { describe, it, expect } from 'bun:test'
import { StatsUseCase } from '../usecases/stats'
import type { EnrollmentDTO } from '../types'

function makeRepo(rows: Partial<EnrollmentDTO>[]) {
  return { findMany: async () => rows } as any
}

describe('capacitacion StatsUseCase', () => {
  it('agrupa completados por empleado dentro del período, ignora otros hoteles/estados', async () => {
    const uc = new StatsUseCase(makeRepo([
      { hotelId: 'h1', employeeId: 'p1', status: 'completed', completedAt: '2026-07-15', score: 80 },
      { hotelId: 'h1', employeeId: 'p1', status: 'completed', completedAt: '2026-07-20', score: 100 },
      { hotelId: 'h1', employeeId: 'p2', status: 'completed', completedAt: '2026-07-10', score: null },
      { hotelId: 'h1', employeeId: 'p1', status: 'enrolled', completedAt: null, score: null },  // no completado
      { hotelId: 'h1', employeeId: 'p1', status: 'completed', completedAt: '2026-06-01', score: 50 }, // fuera de rango
    ]))

    const stats = await uc.getStaffStats('h1', '2026-07-01', '2026-07-31')
    const byId = new Map(stats.map((s) => [s.employeeId, s]))

    expect(byId.get('p1')).toEqual({ employeeId: 'p1', completed: 2, avgScore: 90 })  // (80+100)/2
    expect(byId.get('p2')).toEqual({ employeeId: 'p2', completed: 1, avgScore: null }) // sin nota cargada
  })

  it('sin completados en el período → array vacío', async () => {
    const uc = new StatsUseCase(makeRepo([]))
    expect(await uc.getStaffStats('h1', '2026-07-01', '2026-07-31')).toEqual([])
  })
})
