// marketing/tests/auto-messages-cron.test.ts — DT-18: pre_checkin (offset de días) — antes
// existía en el enum del schema (triggerEvent) pero el cron solo cubría checkin_day/checkout_day.
import { describe, it, expect } from 'bun:test'
import { createAutoMessagesCron } from '../usecases/auto-messages-cron'

// Fecha fija para que el test no dependa del día real de ejecución.
const TODAY = new Date('2026-08-10T12:00:00.000Z')
const RealDate = Date

function withFixedNow(fn: () => Promise<void>) {
  return async () => {
    // Mock mínimo: SOLO `new Date()` sin argumentos ("ahora") queda fijo. `new Date(timestamp)`
    // (usado dentro de firePreCheckin para calcular hoy+offset) debe seguir funcionando normal
    // — si lo pisara también, todos los offsets colapsarían a la misma fecha (TODAY).
    class FixedDate extends RealDate {
      constructor(...args: any[]) {
        if (args.length === 0) super(TODAY.getTime()); else super(args[0])
      }
    }
    global.Date = FixedDate as unknown as DateConstructor
    try { await fn() } finally { global.Date = RealDate }
  }
}

function makeOrm(tables: Record<string, any[]>) {
  return {
    findMany: async (table: string, filters: any) => {
      const rows = tables[table] || []
      return rows.filter((r) => Object.entries(filters || {}).every(([k, v]) => r[k] === v))
    },
  }
}

describe('createAutoMessagesCron — pre_checkin (DT-18)', () => {
  it('dispara pre_checkin para reservas cuyo check-in cae exactamente en hoy+offset', withFixedNow(async () => {
    const orm = makeOrm({
      Hotels: [{ id: 'h1' }],
      Reservations: [
        { id: 'r1', hotelId: 'h1', guestId: 'g1', roomId: 'rm1', checkIn: '2026-08-13', checkOut: '2026-08-15', status: 'confirmed' }, // hoy+3
        { id: 'r2', hotelId: 'h1', guestId: 'g2', roomId: 'rm2', checkIn: '2026-08-20', checkOut: '2026-08-22', status: 'confirmed' }, // fuera de offset
      ],
      AutoMessages: [
        { id: 'am1', hotelId: 'h1', triggerEvent: 'pre_checkin', triggerOffset: 3, isActive: 1 },
      ],
    })
    const calls: any[] = []
    const cron = createAutoMessagesCron(orm, { triggerAutoMessages: async (p: any) => { calls.push(p) } })

    await cron()

    const preCheckinCalls = calls.filter((c) => c.event === 'pre_checkin')
    expect(preCheckinCalls).toHaveLength(1)
    expect(preCheckinCalls[0]).toMatchObject({ hotelId: 'h1', reservationId: 'r1' })
  }))

  it('sin auto-messages pre_checkin activos, no dispara nada nuevo (no rompe checkin_day/checkout_day)', withFixedNow(async () => {
    const orm = makeOrm({
      Hotels: [{ id: 'h1' }],
      Reservations: [],
      AutoMessages: [],
    })
    const calls: any[] = []
    const cron = createAutoMessagesCron(orm, { triggerAutoMessages: async (p: any) => { calls.push(p) } })

    await cron()

    expect(calls).toHaveLength(0)
  }))

  it('dos auto-messages con offsets distintos consultan ambas fechas objetivo', withFixedNow(async () => {
    const orm = makeOrm({
      Hotels: [{ id: 'h1' }],
      Reservations: [
        { id: 'r1', hotelId: 'h1', checkIn: '2026-08-11', status: 'confirmed' }, // hoy+1
        { id: 'r2', hotelId: 'h1', checkIn: '2026-08-15', status: 'confirmed' }, // hoy+5
      ],
      AutoMessages: [
        { id: 'am1', hotelId: 'h1', triggerEvent: 'pre_checkin', triggerOffset: 1, isActive: 1 },
        { id: 'am2', hotelId: 'h1', triggerEvent: 'pre_checkin', triggerOffset: 5, isActive: 1 },
      ],
    })
    const calls: any[] = []
    const cron = createAutoMessagesCron(orm, { triggerAutoMessages: async (p: any) => { calls.push(p) } })

    await cron()

    const ids = calls.filter((c) => c.event === 'pre_checkin').map((c) => c.reservationId).sort()
    expect(ids).toEqual(['r1', 'r2'])
  }))

  it('arma pre_checkin_url a partir del id de la reserva (mismo hash que /checkin/:hash)', withFixedNow(async () => {
    const prevPublicUrl = process.env.PUBLIC_URL
    process.env.PUBLIC_URL = 'https://hotel.zx89.site/'
    try {
      const orm = makeOrm({
        Hotels: [{ id: 'h1' }],
        Reservations: [
          { id: '4d0151a7-9c0f-44e8-97ae-26f2e54c0797', hotelId: 'h1', guestId: 'g1', roomId: 'rm1', checkIn: '2026-08-13', checkOut: '2026-08-15', status: 'confirmed', preCheckinStatus: 'pending' },
        ],
        AutoMessages: [
          { id: 'am1', hotelId: 'h1', triggerEvent: 'pre_checkin', triggerOffset: 3, isActive: 1 },
        ],
      })
      const calls: any[] = []
      const cron = createAutoMessagesCron(orm, { triggerAutoMessages: async (p: any) => { calls.push(p) } })

      await cron()

      const call = calls.find((c) => c.event === 'pre_checkin')
      // Sin guiones, primeros 12 caracteres — mismo criterio que checkinHashFromId/findReservationByHash.
      expect(call.variables.pre_checkin_url).toBe('https://hotel.zx89.site/checkin/4d0151a79c0f')
    } finally {
      if (prevPublicUrl === undefined) delete process.env.PUBLIC_URL; else process.env.PUBLIC_URL = prevPublicUrl
    }
  }))

  it('no molesta a quien ya completó el pre-checkin (preCheckinStatus=completed)', withFixedNow(async () => {
    const orm = makeOrm({
      Hotels: [{ id: 'h1' }],
      Reservations: [
        { id: 'r1', hotelId: 'h1', checkIn: '2026-08-13', status: 'confirmed', preCheckinStatus: 'completed' },
        { id: 'r2', hotelId: 'h1', checkIn: '2026-08-13', status: 'confirmed', preCheckinStatus: 'pending' },
      ],
      AutoMessages: [
        { id: 'am1', hotelId: 'h1', triggerEvent: 'pre_checkin', triggerOffset: 3, isActive: 1 },
      ],
    })
    const calls: any[] = []
    const cron = createAutoMessagesCron(orm, { triggerAutoMessages: async (p: any) => { calls.push(p) } })

    await cron()

    const ids = calls.filter((c) => c.event === 'pre_checkin').map((c) => c.reservationId)
    expect(ids).toEqual(['r2'])
  }))
})
