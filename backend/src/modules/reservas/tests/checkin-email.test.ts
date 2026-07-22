// tests/checkin-email.test.ts — Tests del usecase sendCheckinEmail (spec 11.1.1 + 11.1.6 i18n).
// Sin tocar SQLite: fakes de repos + mock del EmailSender (puerto, no la clase concreta).

import { describe, it, expect, mock } from 'bun:test'
import type { RepositoryAdapter } from 'arckode-framework'
import { silentLogger } from 'arckode-framework/testing'
import type { EmailSender, NotificationInput } from '../../../services/email-sender'
import type { MessageLogSummary } from '../usecases/types'
import { sendCheckinEmail } from '../usecases/checkin-email'

const log = silentLogger()

/** Repo fake con store en memoria (coleccionable para inspección). */
function makeRepo<T extends { id: string }>(store: T[] = []): RepositoryAdapter<T> {
  return {
    findMany: async () => store,
    findById: async (id: string) => store.find((x) => x.id === id) ?? null,
    findOne: async () => store[0] ?? null,
    create: async (data: Omit<T, 'id'>) => { const row = { id: `m-${store.length + 1}`, ...data } as T; store.push(row); return row },
    update: async () => ({} as T),
    delete: async () => true,
    count: async () => store.length,
    paginate: async () => ({ data: store, total: store.length, limit: 20, offset: 0, pages: 1 }),
  } as unknown as RepositoryAdapter<T>
}

const enqueueNotifMock = mock(async () => 'q-1')
const emailSender = { enqueueNotification: enqueueNotifMock } as unknown as EmailSender

describe('sendCheckinEmail (spec 11.1.1 + 11.1.6)', () => {
  it('walk-in sin email → log skipped, no encola', async () => {
    const logs: MessageLogSummary[] = []
    enqueueNotifMock.mockClear()
    await sendCheckinEmail(
      { emailSender, guestRepo: makeRepo([{ id: 'g1', hotelId: 'h1', name: 'Walk', email: undefined }]), roomRepo: makeRepo([]), hotelRepo: makeRepo([]), messageLogRepo: makeRepo(logs), logger: log },
      { reservationId: 'r1', hotelId: 'h1', guestId: 'g1', roomId: 'room1', checkIn: '2026-01-01', checkOut: '2026-01-03' },
    )
    expect(enqueueNotifMock).not.toHaveBeenCalled()
    expect(logs[0].status).toBe('skipped')
  })

  it('guest con email → enqueueNotification event=checkin_welcome + log sent', async () => {
    const logs: MessageLogSummary[] = []
    enqueueNotifMock.mockClear()
    await sendCheckinEmail(
      {
        emailSender,
        guestRepo: makeRepo([{ id: 'g1', hotelId: 'h1', name: 'Ana', email: 'a@b.com', nationality: 'Argentina' }]),
        roomRepo: makeRepo([{ id: 'room1', hotelId: 'h1', number: '101' }]),
        hotelRepo: makeRepo([{ id: 'h1', name: 'Palma', address: 'Calle 1', phone: '555' }]),
        messageLogRepo: makeRepo(logs), logger: log,
      },
      { reservationId: 'r1', hotelId: 'h1', guestId: 'g1', roomId: 'room1', checkIn: '2026-01-01', checkOut: '2026-01-03' },
    )
    expect(enqueueNotifMock).toHaveBeenCalledTimes(1)
    const call = (enqueueNotifMock.mock.calls as unknown[][])[0]?.[0] as NotificationInput
    expect(call.to).toBe('a@b.com')
    expect(call.event).toBe('checkin_welcome')
    expect(call.language).toBe('es') // nationality 'Argentina' → es
    expect(call.relatedType).toBe('checkin')
    expect(logs[0].status).toBe('sent')
    expect(logs[0].recipient).toBe('a@b.com')
    expect(logs[0].messageId).toBe('q-1') // queueId propagado al log (fix H3 — antes guardaba el subject crudo)
    expect(logs[0].response).toBe('notification:checkin_welcome [es]')
  })

  it('guest nationality US → language en', async () => {
    const logs: MessageLogSummary[] = []
    enqueueNotifMock.mockClear()
    await sendCheckinEmail(
      {
        emailSender,
        guestRepo: makeRepo([{ id: 'g2', hotelId: 'h1', name: 'John', email: 'j@b.com', nationality: 'United States' }]),
        roomRepo: makeRepo([{ id: 'room1', hotelId: 'h1', number: '101' }]),
        hotelRepo: makeRepo([{ id: 'h1', name: 'Palma' }]),
        messageLogRepo: makeRepo(logs), logger: log,
      },
      { reservationId: 'r2', hotelId: 'h1', guestId: 'g2', roomId: 'room1', checkIn: '2026-01-01', checkOut: '2026-01-03' },
    )
    const call = (enqueueNotifMock.mock.calls as unknown[][])[0]?.[0] as NotificationInput
    expect(call.language).toBe('en')
  })

  it('sin guestId → return early (no loggea)', async () => {
    const logs: MessageLogSummary[] = []
    await sendCheckinEmail(
      { emailSender, guestRepo: makeRepo([]), roomRepo: makeRepo([]), hotelRepo: makeRepo([]), messageLogRepo: makeRepo(logs), logger: log },
      { reservationId: 'r1', hotelId: 'h1', guestId: null, roomId: 'room1', checkIn: '2026-01-01', checkOut: '2026-01-03' },
    )
    expect(logs.length).toBe(0)
  })

  it('llena lock_code con el código TTLock activo de la reserva', async () => {
    const logs: MessageLogSummary[] = []
    enqueueNotifMock.mockClear()
    await sendCheckinEmail(
      {
        emailSender,
        guestRepo: makeRepo([{ id: 'g1', hotelId: 'h1', name: 'Ana', email: 'a@b.com' }]),
        roomRepo: makeRepo([{ id: 'room1', hotelId: 'h1', number: '101' }]),
        hotelRepo: makeRepo([{ id: 'h1', name: 'Palma' }]),
        messageLogRepo: makeRepo(logs),
        // status 'pending' además del activo: debe preferir el 'active'.
        lockCodeRepo: makeRepo([
          { id: 'lc0', reservationId: 'r1', hotelId: 'h1', code: '0000', status: 'expired' },
          { id: 'lc1', reservationId: 'r1', hotelId: 'h1', code: '4821', status: 'active' },
        ]) as any,
        logger: log,
      },
      { reservationId: 'r1', hotelId: 'h1', guestId: 'g1', roomId: 'room1', checkIn: '2026-01-01', checkOut: '2026-01-03' },
    )
    const call = (enqueueNotifMock.mock.calls as unknown[][])[0]?.[0] as NotificationInput
    expect(call.variables.lock_code).toBe('4821')
  })

  it('sin lockCodeRepo → lock_code queda vacío (comportamiento previo)', async () => {
    enqueueNotifMock.mockClear()
    await sendCheckinEmail(
      {
        emailSender,
        guestRepo: makeRepo([{ id: 'g1', hotelId: 'h1', name: 'Ana', email: 'a@b.com' }]),
        roomRepo: makeRepo([{ id: 'room1', hotelId: 'h1', number: '101' }]),
        hotelRepo: makeRepo([{ id: 'h1', name: 'Palma' }]),
        messageLogRepo: makeRepo([]), logger: log,
      },
      { reservationId: 'r1', hotelId: 'h1', guestId: 'g1', roomId: 'room1', checkIn: '2026-01-01', checkOut: '2026-01-03' },
    )
    const call = (enqueueNotifMock.mock.calls as unknown[][])[0]?.[0] as NotificationInput
    expect(call.variables.lock_code).toBe('')
  })
})
