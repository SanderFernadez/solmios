// mark-no-shows.test.ts — #276: markNoShows consulta solo pending/confirmed (no todo el histórico)
// y libera la habitación de cada no-show.
import { describe, it, expect } from 'bun:test'
import { ReportQueries } from '../usecases/report-queries'

const AYER = '2026-07-20'
const HOY = new Date().toISOString().split('T')[0]
const MANANA = new Date(Date.now() + 86_400_000).toISOString().split('T')[0]

function makeOrm(byStatus: Record<string, any[]>) {
  const queried: string[] = []
  const updates: Array<{ model: string; id: string; patch: any }> = []
  const orm = {
    findMany: async (_model: string, filter: any) => {
      queried.push(filter.status)
      return byStatus[filter.status] ?? []
    },
    update: async (model: string, id: string, patch: any) => { updates.push({ model, id, patch }); return { id, ...patch } },
  }
  return { orm, queried, updates }
}

describe('markNoShows (#276)', () => {
  it('solo consulta pending y confirmed, nunca todo el histórico', async () => {
    const { orm, queried } = makeOrm({ pending: [], confirmed: [] })
    await new ReportQueries(orm).markNoShows('h1')
    expect(queried.sort()).toEqual(['confirmed', 'pending'])
  })

  it('marca no_show y libera la habitación de las reservas vencidas', async () => {
    const { orm, updates } = makeOrm({
      pending: [{ id: 'r1', checkIn: AYER, roomId: 'room1' }],
      confirmed: [{ id: 'r2', checkIn: AYER, roomId: 'room2' }],
    })
    const n = await new ReportQueries(orm).markNoShows('h1')
    expect(n).toBe(2)
    expect(updates).toContainEqual({ model: 'Reservations', id: 'r1', patch: { status: 'no_show' } })
    expect(updates).toContainEqual({ model: 'Rooms', id: 'room1', patch: { status: 'available' } })
    expect(updates).toContainEqual({ model: 'Reservations', id: 'r2', patch: { status: 'no_show' } })
    expect(updates).toContainEqual({ model: 'Rooms', id: 'room2', patch: { status: 'available' } })
  })

  it('NO toca las reservas cuyo check-in es hoy o futuro', async () => {
    const { orm, updates } = makeOrm({
      pending: [{ id: 'r1', checkIn: HOY, roomId: 'room1' }, { id: 'r2', checkIn: MANANA, roomId: 'room2' }],
      confirmed: [],
    })
    const n = await new ReportQueries(orm).markNoShows('h1')
    expect(n).toBe(0)
    expect(updates).toHaveLength(0)
  })

  it('una no-show sin roomId no rompe (solo marca la reserva)', async () => {
    const { orm, updates } = makeOrm({ pending: [{ id: 'r1', checkIn: AYER, roomId: null }], confirmed: [] })
    const n = await new ReportQueries(orm).markNoShows('h1')
    expect(n).toBe(1)
    expect(updates).toEqual([{ model: 'Reservations', id: 'r1', patch: { status: 'no_show' } }])
  })
})
