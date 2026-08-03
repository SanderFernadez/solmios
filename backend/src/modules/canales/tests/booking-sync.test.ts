// canales/tests/booking-sync.test.ts — Ola 1 cron Channex (issue #564)
//
// Cubre el path GLOBAL de ingesta de bookings: resolución propertyId→hotelId, dedupe,
// unmapped, feed vacío y resiliencia (un fallo por item no corta el loop).
// También cubre `mapBookingRevision` como función pura (sin IO).
import { describe, it, expect } from 'bun:test'
import { mapBookingRevision } from '../usecases/booking-ingestion'
import { BookingSyncUseCase } from '../usecases/booking-sync'
import type { BookingRevisionDTO } from '../types'

const fakeLogger = { info: () => {}, warn: () => {} }

// ─── Builders de fixtures ───────────────────────────────────────────────
function makeRevision(over: Partial<BookingRevisionDTO> = {}): BookingRevisionDTO {
  return {
    id: 'rev-1',
    propertyId: 'propA',
    bookingId: 'bk-1',
    uniqueId: 'U-1',
    otaReservationCode: 'OTA-1',
    otaName: 'booking.com',
    status: 'new',
    arrivalDate: '2026-09-01',
    departureDate: '2026-09-03',
    amount: '120.50',
    currency: 'USD',
    customer: { name: 'John', surname: 'Doe', mail: 'j@x.com', phone: '+18095550000' },
    rooms: [{
      roomTypeId: 'rt-1', ratePlanId: 'rp-1',
      checkinDate: '2026-09-01', checkoutDate: '2026-09-03', amount: '120.50',
      occupancy: { adults: 2, children: 1, infants: 1 },
    }],
    insertedAt: '2026-08-01T00:00:00Z',
    ...over,
  }
}

function makeChannexStub(feed: BookingRevisionDTO[], opts: { ackFailId?: string } = {}) {
  const ackCalls: string[] = []
  const channex: any = {
    fetchBookingFeed: async () => feed,
    ackBooking: async (_key: string, revId: string) => {
      ackCalls.push(revId)
      if (opts.ackFailId && revId === opts.ackFailId) throw new Error('ack boom')
      return true
    },
    getRoomTypeById: async () => ({ id: 'rt-1', title: 'Double' }),
  }
  return { channex, ackCalls }
}

function makeOrm(opts: {
  configs?: any[]
  existingRes?: any[]
  rooms?: any[]
  createThrowOnCall?: number  // número de llamada a create que lanza (1-based)
} = {}) {
  const created: any[] = []
  let createCalls = 0
  const orm: any = {
    findMany: async (model: string) => {
      if (model === 'Canales') return opts.configs ?? []
      if (model === 'Reservations') return opts.existingRes ?? []
      if (model === 'Rooms') return opts.rooms ?? [{ id: 'room-1', type: 'Double' }]
      return []
    },
    create: async (_model: string, payload: any) => {
      createCalls++
      if (opts.createThrowOnCall && createCalls === opts.createThrowOnCall) {
        throw new Error('DB write failed')
      }
      created.push(payload)
      return payload
    },
    update: async () => {},
  }
  return { orm, created }
}

const deps = (channex: any, orm: any) => ({
  channex, queries: {} as any, orm, logger: fakeLogger as any,
})

// ─── mapBookingRevision — función pura ──────────────────────────────────
describe('mapBookingRevision — función pura', () => {
  it('customer sin name ni surname → otaNotes usa "OTA Guest"', () => {
    const dto = mapBookingRevision(makeRevision({ customer: {} }), 'h1')
    expect(dto.otaNotes).toContain('OTA Guest')
  })

  it('customer con name pero sin surname → usa el name (no "OTA Guest")', () => {
    const dto = mapBookingRevision(makeRevision({ customer: { name: 'Carol' } }), 'h1')
    expect(dto.otaNotes).toContain('Carol')
    expect(dto.otaNotes).not.toContain('OTA Guest')
  })

  it('status cancelled → dto.status "cancelled"; otro status → "confirmed"', () => {
    expect(mapBookingRevision(makeRevision({ status: 'cancelled' }), 'h1').status).toBe('cancelled')
    expect(mapBookingRevision(makeRevision({ status: 'new' }), 'h1').status).toBe('confirmed')
    expect(mapBookingRevision(makeRevision({ status: 'modified' }), 'h1').status).toBe('confirmed')
  })

  it('adults/children desde occupancy: adults directo, children = children + infants', () => {
    // default: adults:2, children:1, infants:1 → adults 2, children 2
    const dto = mapBookingRevision(makeRevision(), 'h1')
    expect(dto.adults).toBe(2)
    expect(dto.children).toBe(2)
  })

  it('occupancy ausente → adults default 2, children 0', () => {
    const rev = makeRevision({
      rooms: [{
        roomTypeId: null, ratePlanId: null, checkinDate: '', checkoutDate: '', amount: '',
        occupancy: undefined as any,
      }],
    })
    const dto = mapBookingRevision(rev, 'h1')
    expect(dto.adults).toBe(2)
    expect(dto.children).toBe(0)
  })

  it('externalLocator = otaReservationCode || uniqueId', () => {
    expect(mapBookingRevision(makeRevision({ otaReservationCode: 'OTA-9' }), 'h1').externalLocator).toBe('OTA-9')
    expect(mapBookingRevision(makeRevision({ otaReservationCode: '', uniqueId: 'UID-9' }), 'h1').externalLocator).toBe('UID-9')
  })

  it('hotelId inyectado por parámetro (no desde cfg)', () => {
    expect(mapBookingRevision(makeRevision(), 'hotelXYZ').hotelId).toBe('hotelXYZ')
  })
})

// ─── BookingSyncUseCase — resolución multi-tenancy ──────────────────────
describe('BookingSyncUseCase — path global (issue #564)', () => {
  it('cada revisión lleva el hotelId de su propertyId', async () => {
    const configs = [
      { hotelId: 'hotelA', channexPropertyId: 'propA', syncEnabled: 1 },
      { hotelId: 'hotelB', channexPropertyId: 'propB', syncEnabled: 1 },
    ]
    const feed = [
      makeRevision({ id: 'r1', propertyId: 'propA', uniqueId: 'u1', otaReservationCode: 'ota1' }),
      makeRevision({ id: 'r2', propertyId: 'propB', uniqueId: 'u2', otaReservationCode: 'ota2' }),
    ]
    const { channex } = makeChannexStub(feed)
    const { orm, created } = makeOrm({ configs })
    const res = await new BookingSyncUseCase(deps(channex, orm)).run()

    expect(res.ingested).toBe(2)
    expect(res.unmapped).toBe(0)
    expect(created.find(c => c.hotelId === 'hotelA')).toBeTruthy()
    expect(created.find(c => c.hotelId === 'hotelB')).toBeTruthy()
  })

  it('propertyId no mapeado → unmapped=1, no se crea ni se ackea', async () => {
    const configs = [{ hotelId: 'hotelA', channexPropertyId: 'propA', syncEnabled: 1 }]
    const feed = [makeRevision({ id: 'r1', propertyId: 'propZ', uniqueId: 'u1' })]
    const { channex, ackCalls } = makeChannexStub(feed)
    const { orm, created } = makeOrm({ configs })
    const res = await new BookingSyncUseCase(deps(channex, orm)).run()

    expect(res.unmapped).toBe(1)
    expect(res.ingested).toBe(0)
    expect(created).toHaveLength(0)
    expect(ackCalls).toHaveLength(0) // NO se ackea (queda para cuando el hotel sincronice)
    expect(res.success).toBe(true)   // unmapped no es un error
  })

  it('dedupe: externalLocator ya existe → skipped sube, ack SÍ se llama', async () => {
    const configs = [{ hotelId: 'hotelA', channexPropertyId: 'propA', syncEnabled: 1 }]
    const feed = [makeRevision({ id: 'r1', propertyId: 'propA', otaReservationCode: 'EXISTING-1' })]
    const { channex, ackCalls } = makeChannexStub(feed)
    const { orm, created } = makeOrm({ configs, existingRes: [{ id: 'res-old' }] })
    const res = await new BookingSyncUseCase(deps(channex, orm)).run()

    expect(res.skipped).toBe(1)
    expect(res.ingested).toBe(0)
    expect(created).toHaveLength(0)
    expect(ackCalls).toHaveLength(1) // se ackea igual → drena el feed
    expect(res.acknowledged).toBe(1)
  })

  it('feed vacío → feedSize 0, métricas en cero, success true', async () => {
    const configs = [{ hotelId: 'hotelA', channexPropertyId: 'propA', syncEnabled: 1 }]
    const { channex } = makeChannexStub([])
    const { orm } = makeOrm({ configs })
    const res = await new BookingSyncUseCase(deps(channex, orm)).run()

    expect(res.feedSize).toBe(0)
    expect(res.ingested).toBe(0)
    expect(res.acknowledged).toBe(0)
    expect(res.skipped).toBe(0)
    expect(res.unmapped).toBe(0)
    expect(res.success).toBe(true)
  })

  it('una revisión que throw → errors sube, el resto del loop continúa, success false', async () => {
    const configs = [{ hotelId: 'hotelA', channexPropertyId: 'propA', syncEnabled: 1 }]
    const feed = [
      makeRevision({ id: 'r1', propertyId: 'propA', uniqueId: 'u1', otaReservationCode: 'ota1' }),
      makeRevision({ id: 'r2', propertyId: 'propA', uniqueId: 'u2', otaReservationCode: 'ota2' }),
    ]
    const { channex } = makeChannexStub(feed)
    // La 2da llamada a create lanza → simula fallo de DB aislado.
    const { orm } = makeOrm({ configs, createThrowOnCall: 2 })
    const res = await new BookingSyncUseCase(deps(channex, orm)).run()

    expect(res.ingested).toBe(1)            // la 1ra sí se creó
    expect(res.errors).toHaveLength(1)      // la 2da falló
    expect(res.errors[0]).toContain('u2')
    expect(res.success).toBe(false)
  })

  it('#542: hotel con suscripción suspendida → suspended sube, no se crea ni se ackea', async () => {
    const configs = [{ hotelId: 'hotelA', channexPropertyId: 'propA', syncEnabled: 1 }]
    const feed = [makeRevision({ id: 'r1', propertyId: 'propA', uniqueId: 'u1', otaReservationCode: 'ota1' })]
    const { channex, ackCalls } = makeChannexStub(feed)
    const { orm, created } = makeOrm({ configs })
    const usecase = new BookingSyncUseCase(deps(channex, orm))
    usecase.setSubscriptionCheck(async () => ({ allowed: false }))
    const res = await usecase.run()

    expect(res.suspended).toBe(1)
    expect(res.ingested).toBe(0)
    expect(created).toHaveLength(0)
    expect(ackCalls).toHaveLength(0) // NO se ackea (se reintenta si el hotel se reactiva)
    expect(res.success).toBe(true)   // suspended no es un error
  })

  it('#542: hotel con suscripción activa (allowed:true) → ingesta normal, sin regresión', async () => {
    const configs = [{ hotelId: 'hotelA', channexPropertyId: 'propA', syncEnabled: 1 }]
    const feed = [makeRevision({ id: 'r1', propertyId: 'propA', uniqueId: 'u1', otaReservationCode: 'ota1' })]
    const { channex } = makeChannexStub(feed)
    const { orm, created } = makeOrm({ configs })
    const usecase = new BookingSyncUseCase(deps(channex, orm))
    usecase.setSubscriptionCheck(async () => ({ allowed: true }))
    const res = await usecase.run()

    expect(res.suspended).toBe(0)
    expect(res.ingested).toBe(1)
    expect(created).toHaveLength(1)
  })

  it('sin setSubscriptionCheck cableado → no bloquea nada (comportamiento previo intacto)', async () => {
    const configs = [{ hotelId: 'hotelA', channexPropertyId: 'propA', syncEnabled: 1 }]
    const feed = [makeRevision({ id: 'r1', propertyId: 'propA', uniqueId: 'u1', otaReservationCode: 'ota1' })]
    const { channex } = makeChannexStub(feed)
    const { orm, created } = makeOrm({ configs })
    const res = await new BookingSyncUseCase(deps(channex, orm)).run()

    expect(res.suspended).toBe(0)
    expect(res.ingested).toBe(1)
    expect(created).toHaveLength(1)
  })

  it('config con channexPropertyId vacío se ignora del mapa', async () => {
    const configs = [
      { hotelId: 'hotelA', channexPropertyId: 'propA', syncEnabled: 1 },
      { hotelId: 'hotelC', channexPropertyId: null, syncEnabled: 1 }, // sin sincronizar
    ]
    const feed = [makeRevision({ id: 'r1', propertyId: 'propA', uniqueId: 'u1', otaReservationCode: 'ota1' })]
    const { channex, ackCalls } = makeChannexStub(feed)
    const { orm } = makeOrm({ configs })
    const res = await new BookingSyncUseCase(deps(channex, orm)).run()

    expect(res.ingested).toBe(1)
    expect(res.unmapped).toBe(0)
    expect(ackCalls).toHaveLength(1)
  })
})
