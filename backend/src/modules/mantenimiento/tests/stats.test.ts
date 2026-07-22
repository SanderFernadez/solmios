// mantenimiento/tests/stats.test.ts — getStaffStats: productividad por técnico para el motor #321.
import { describe, it, expect } from 'bun:test'
import type { RepositoryAdapter } from 'arckode-framework'
import { StatsUseCase } from '../usecases/stats'

const HOUR = 3_600_000
function at(day: string, hoursDur: number) {
  const start = `${day}T08:00:00.000Z`
  const end = new Date(Date.parse(start) + hoursDur * HOUR).toISOString()
  return { startTime: start, endTime: end, resolvedDate: end }
}
function repoWith(rows: any[]): RepositoryAdapter<any> {
  return { findMany: async () => rows } as any
}

describe('StatsUseCase.getStaffStats', () => {
  it('agrega resueltos/cerrados por técnico dentro del período, con avgResolutionMs', async () => {
    const rows = [
      { hotelId: 'h1', status: 'closed', assignedTo: 'u1', ...at('2026-07-10', 2) },
      { hotelId: 'h1', status: 'resolved', assignedTo: 'u1', ...at('2026-07-15', 4) },
      { hotelId: 'h1', status: 'closed', assignedTo: 'u2', ...at('2026-07-12', 6) },
      { hotelId: 'h1', status: 'open', assignedTo: 'u1', ...at('2026-07-11', 1) },     // no terminado → excluido
      { hotelId: 'h1', status: 'closed', assignedTo: 'u1', ...at('2026-08-05', 3) },   // fuera de período → excluido
      { hotelId: 'h1', status: 'closed', assignedTo: null, ...at('2026-07-13', 5) },   // sin técnico → excluido
    ]
    const stats = await new StatsUseCase(repoWith(rows)).getStaffStats('h1', '2026-07-01', '2026-07-31')
    const byId = Object.fromEntries(stats.map((s) => [s.staffId, s]))
    expect(byId['u1'].resolved).toBe(2)
    expect(byId['u1'].avgResolutionMs).toBe(3 * HOUR)   // (2h + 4h) / 2
    expect(byId['u2'].resolved).toBe(1)
    expect(byId['u2'].avgResolutionMs).toBe(6 * HOUR)
  })

  it('avgResolutionMs = 0 si el ticket no tiene startTime/endTime (sin data de duración)', async () => {
    const rows = [{ hotelId: 'h1', status: 'closed', assignedTo: 'u3', resolvedDate: '2026-07-10T10:00:00.000Z' }]
    const stats = await new StatsUseCase(repoWith(rows)).getStaffStats('h1', '2026-07-01', '2026-07-31')
    expect(stats[0]).toEqual({ staffId: 'u3', resolved: 1, avgResolutionMs: 0 })
  })
})
