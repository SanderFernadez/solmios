// tests/checkin-email.test.ts — Tests del usecase sendCheckinEmail (spec 11.1.1).
// Sin tocar SQLite: fakes de repos + mock del EmailService.

import { describe, it, expect, mock } from 'bun:test'
import type { RepositoryAdapter } from 'arckode-framework'
import { silentLogger } from 'arckode-framework/testing'
import { sendCheckinEmail } from '../usecases/checkin-email'

const log = silentLogger()

/** Repo fake con store en memoria (coleccionable para inspección). */
function makeRepo<T extends { id: string }>(store: T[] = []): RepositoryAdapter<T> {
  return {
    findMany: async () => store,
    findById: async (id: string) => store.find((x) => x.id === id) ?? null,
    findOne: async () => store[0] ?? null,
    create: async (data: any) => { const row = { id: `m-${store.length + 1}`, ...data } as T; store.push(row); return row },
    update: async () => ({} as T),
    delete: async () => true,
    count: async () => store.length,
    paginate: async () => ({ data: store, total: store.length, limit: 20, offset: 0, pages: 1 }),
  } as unknown as RepositoryAdapter<T>
}

const enqueueMock = mock(async () => 'q-1')
const emailService = { enqueue: enqueueMock } as any

describe('sendCheckinEmail (spec 11.1.1)', () => {
  it('walk-in sin email → log skipped, no encola', async () => {
    const logs: any[] = []
    enqueueMock.mockClear()
    await sendCheckinEmail(
      { emailService, guestRepo: makeRepo([{ id: 'g1', hotelId: 'h1', name: 'Walk', email: undefined }]), roomRepo: makeRepo([]), hotelRepo: makeRepo([]), messageLogRepo: makeRepo(logs), logger: log },
      { reservationId: 'r1', hotelId: 'h1', guestId: 'g1', roomId: 'room1', checkIn: '2026-01-01', checkOut: '2026-01-03' },
    )
    expect(enqueueMock).not.toHaveBeenCalled()
    expect(logs[0].status).toBe('skipped')
  })

  it('guest con email → enqueue + log sent con recipient', async () => {
    const logs: any[] = []
    enqueueMock.mockClear()
    await sendCheckinEmail(
      {
        emailService,
        guestRepo: makeRepo([{ id: 'g1', hotelId: 'h1', name: 'Ana', email: 'a@b.com' }]),
        roomRepo: makeRepo([{ id: 'room1', hotelId: 'h1', number: '101' }]),
        hotelRepo: makeRepo([{ id: 'h1', name: 'Palma', address: 'Calle 1', phone: '555' }]),
        messageLogRepo: makeRepo(logs), logger: log,
      },
      { reservationId: 'r1', hotelId: 'h1', guestId: 'g1', roomId: 'room1', checkIn: '2026-01-01', checkOut: '2026-01-03' },
    )
    expect(enqueueMock).toHaveBeenCalledTimes(1)
    const call = (enqueueMock.mock.calls as any[][])[0][0]
    expect(call.to).toBe('a@b.com')
    expect(call.relatedType).toBe('checkin')
    expect(logs[0].status).toBe('sent')
    expect(logs[0].recipient).toBe('a@b.com')
  })

  it('sin guestId → return early (no loggea)', async () => {
    const logs: any[] = []
    await sendCheckinEmail(
      { emailService, guestRepo: makeRepo([]), roomRepo: makeRepo([]), hotelRepo: makeRepo([]), messageLogRepo: makeRepo(logs), logger: log },
      { reservationId: 'r1', hotelId: 'h1', guestId: null, roomId: 'room1', checkIn: '2026-01-01', checkOut: '2026-01-03' },
    )
    expect(logs.length).toBe(0)
  })
})
