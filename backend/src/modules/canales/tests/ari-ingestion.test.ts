import { describe, it, expect } from 'bun:test'
import { computeAvailabilityRanges, buildAvailabilityRanges } from '../usecases/availability'
import { applyBookingRevision } from '../usecases/booking-ingestion'

// QA-02 (#296): flujo de canales — push de ARI (disponibilidad) a Channex + ingesta de bookings OTA.

describe('push ARI — computeAvailabilityRanges (QA-02)', () => {
  it('disponibilidad = total − ocupadas por día y agrupa días consecutivos iguales', () => {
    // 2 habitaciones; una reserva ocupa 02 y 03 (checkOut exclusivo).
    const ranges = computeAvailabilityRanges('2026-06-01', '2026-06-05', 2,
      [{ checkIn: '2026-06-02', checkOut: '2026-06-04' }], [])
    expect(ranges).toEqual([
      { dateFrom: '2026-06-01', dateTo: '2026-06-01', availability: 2 },
      { dateFrom: '2026-06-02', dateTo: '2026-06-03', availability: 1 },
      { dateFrom: '2026-06-04', dateTo: '2026-06-04', availability: 2 },
    ])
  })

  it('un bloqueo (endDate inclusivo) también resta disponibilidad', () => {
    const ranges = computeAvailabilityRanges('2026-06-01', '2026-06-03', 1, [],
      [{ startDate: '2026-06-01', endDate: '2026-06-01' }])
    expect(ranges[0]).toEqual({ dateFrom: '2026-06-01', dateTo: '2026-06-01', availability: 0 })
    expect(ranges[1].availability).toBe(1)
  })
})

describe('push ARI — buildAvailabilityRanges (QA-02)', () => {
  const rooms = [{ id: 'r1', type: 'suite' }, { id: 'r2', type: 'suite' }, { id: 'r3', type: 'double' }]
  it('devuelve rangos para el tipo pedido (excluye reservas canceladas)', () => {
    const res = buildAvailabilityRanges('suite', rooms, [], [])
    expect(res).not.toBeNull()
    expect(Array.isArray(res)).toBe(true)
  })
  it('devuelve null si el hotel no tiene habitaciones de ese tipo (nada que empujar)', () => {
    expect(buildAvailabilityRanges('triple', rooms, [], [])).toBeNull()
  })
})

describe('ingesta OTA — applyBookingRevision (QA-02)', () => {
  it('dedupe: NO vuelve a crear si el locator externo ya existe', async () => {
    const created: any[] = []
    const orm: any = {
      findMany: async (t: string, q: any) => (t === 'Reservations' && q.externalLocator === 'OTA123' ? [{ id: 'existing' }] : []),
      update: async () => {},
      create: async (_t: string, d: any) => { created.push(d); return d },
    }
    await applyBookingRevision({ orm, channex: {} as any, hotelId: 'h1', apiKey: 'k' }, { externalLocator: 'OTA123', status: 'new' })
    expect(created).toHaveLength(0)
  })

  it('cancelación OTA actualiza la reserva existente a cancelled', async () => {
    const updates: any[] = []
    const orm: any = {
      findMany: async (t: string) => (t === 'Reservations' ? [{ id: 'existing' }] : []),
      update: async (_t: string, id: string, d: any) => { updates.push({ id, ...d }) },
      create: async () => {},
    }
    await applyBookingRevision({ orm, channex: {} as any, hotelId: 'h1', apiKey: 'k' }, { externalLocator: 'OTA123', status: 'cancelled' })
    expect(updates).toHaveLength(1)
    expect(updates[0].id).toBe('existing')
    expect(updates[0].status).toBe('cancelled')
  })
})
