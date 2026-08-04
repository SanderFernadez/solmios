// bookingengine/tests/public-rates-seasons.test.ts
//
// `/rates` cotiza con el MISMO resolver de precio por fecha que `/calendar`.
//
// Antes, `/rates` hacía `min(rooms.basePrice del type) × noches` e ignoraba las temporadas: en un
// hotel con temporadas cargadas el calendario de la landing anunciaba un precio y el buscador
// cotizaba otro para las mismas fechas. Ahora suma el precio de CADA noche
// (`usecases/rate-resolution.ts`, compartido por los dos endpoints).
//
// Casos:
//  (a) Hotel SIN temporadas cargadas cotiza EXACTAMENTE igual que antes (regresión de precio).
//      Es el caso real de casi todos los hoteles hoy: es lo que no se puede romper.
//  (b) Estadía que cruza dos temporadas suma el precio de cada noche (no promedia ni multiplica).
//  (c) Noche con temporada asignada pero SIN fila en `room_rates` cae a `rooms.basePrice`.
//  (d) COHERENCIA: el total de `/rates` == suma de los `fromPrice` diarios de `/calendar` para
//      las mismas noches y `guests`. Este es el que evita que la incoherencia vuelva.
// (+) Criterio de canal (override de OTA no se filtra) y de ocupación (per_person), espejando
//     el calendario. Y degradación: sin repos cableados / repo que revienta → precio base.
import { describe, it, expect } from 'bun:test'
import { getPublicRates } from '../usecases/public-rates'
import { getPublicCalendar } from '../usecases/public-calendar'
import { eachDayExclusive, addDays } from '../../../shared/utils/daily-availability'
import type { AvailabilityResult } from '../types'

const HOTEL_ID = 'h1'
const SLUG = 'caribe-paradise'

const baseHotel = (overrides: Partial<any> = {}): any => ({
  id: HOTEL_ID, name: 'Caribe Paradise', slug: SLUG,
  onlineBookingStatus: 'active', currency: 'USD',
  ...overrides,
})

const repo = (rows: any[]) => ({
  findMany: async (_f?: any) => rows,
  findOne: async (_f?: any) => rows[0] ?? null,
}) as any

const hotelsRepo = (hotel: any) => ({ findOne: async () => hotel }) as any

/** Availability real-ish: `price` = min(basePrice) del type, como lo calcula `aggregate`. */
const makeAvailability = (rooms: any[], checkIn: string, checkOut: string) => {
  const byType = new Map<string, { available: number; price: number; capacity: number }>()
  for (const r of rooms) {
    const cur = byType.get(r.type) ?? { available: 0, price: 0, capacity: r.capacity ?? 2 }
    const p = Number(r.basePrice) || 0
    if (p > 0 && (cur.price === 0 || p < cur.price)) cur.price = p
    cur.available++
    byType.set(r.type, cur)
  }
  const roomTypes = [...byType.entries()].map(([roomType, d]) => ({
    roomType, available: d.available, price: d.price, currency: 'USD',
    capacity: d.capacity, surfaceArea: 0, amenities: [],
  }))
  const result: AvailabilityResult = {
    hotelId: HOTEL_ID, hotelName: 'Caribe Paradise', checkIn, checkOut,
    nights: eachDayExclusive(checkIn, checkOut).length, roomTypes,
  }
  return { checkAvailability: async () => result }
}

interface Scenario {
  rooms?: any[]
  assignments?: any[]
  rates?: any[]
  hotel?: any
  /** `false` → no se cablean los repos de temporadas (compat callers viejos). */
  wired?: boolean
}

const ROOMS_DEFAULT = [{ id: 'r1', hotelId: HOTEL_ID, type: 'standard', capacity: 2, basePrice: 100, status: 'available' }]

const ratesDeps = (s: Scenario, checkIn: string, checkOut: string) => {
  const rooms = s.rooms ?? ROOMS_DEFAULT
  const base: any = {
    hotels: hotelsRepo(s.hotel ?? baseHotel()),
    availability: makeAvailability(rooms, checkIn, checkOut),
    config: { findMany: async () => [] },
  }
  if (s.wired !== false) {
    base.seasonAssignments = repo(s.assignments ?? [])
    base.roomRates = repo(s.rates ?? [])
  }
  return base
}

const calendarDeps = (s: Scenario) => ({
  hotels: hotelsRepo(s.hotel ?? baseHotel()),
  rooms: repo(s.rooms ?? ROOMS_DEFAULT),
  reservations: repo([]),
  roomBlocks: repo([]),
  seasonAssignments: repo(s.assignments ?? []),
  roomRates: repo(s.rates ?? []),
  config: { findMany: async () => [] },
}) as any

// ─── (a) Regresión: hotel SIN temporadas cotiza igual que antes ──────────────────────────────

describe('/rates — hotel SIN temporadas: cero regresión de precio', () => {
  it('sin ninguna fila de season_assignments ni room_rates → price × noches (idéntico a antes)', async () => {
    const res = await getPublicRates(
      ratesDeps({}, '2026-09-01', '2026-09-04') as any,
      SLUG, { checkIn: '2026-09-01', checkOut: '2026-09-04' },
    )
    expect(res.status).toBe(200)
    // 100/noche × 3 noches = 300. Exactamente lo que devolvía la versión vieja.
    expect(res.body.roomTypes[0].fromPrice).toBe(300)
    expect(res.body.nights).toBe(3)
  })

  it('repos de temporadas NO cableados (callers/tests viejos) → mismo total, no revienta', async () => {
    const res = await getPublicRates(
      ratesDeps({ wired: false }, '2026-09-01', '2026-09-04') as any,
      SLUG, { checkIn: '2026-09-01', checkOut: '2026-09-04' },
    )
    expect(res.body.roomTypes[0].fromPrice).toBe(300)
  })

  it('hay temporadas pintadas pero NINGUNA tarifa cargada → sigue cotizando al precio base', async () => {
    const assignments = eachDayExclusive('2026-09-01', '2026-09-04')
      .map((date) => ({ hotelId: HOTEL_ID, date, season: 'alta' }))
    const res = await getPublicRates(
      ratesDeps({ assignments }, '2026-09-01', '2026-09-04') as any,
      SLUG, { checkIn: '2026-09-01', checkOut: '2026-09-04' },
    )
    expect(res.body.roomTypes[0].fromPrice).toBe(300)
  })

  it('el repo de temporadas revienta → degrada al precio base, no tumba la cotización pública', async () => {
    const deps = ratesDeps({}, '2026-09-01', '2026-09-04')
    deps.seasonAssignments = { findMany: async () => { throw new Error('db down') } }
    const res = await getPublicRates(deps as any, SLUG, { checkIn: '2026-09-01', checkOut: '2026-09-04' })
    expect(res.status).toBe(200)
    expect(res.body.roomTypes[0].fromPrice).toBe(300)
  })

  it('impuestos siguen calculándose sobre el fromPrice pre-impuestos (contrato intacto)', async () => {
    const deps = ratesDeps({}, '2026-09-01', '2026-09-03')
    deps.config = {
      findMany: async (f: any) => f?.key === 'taxes'
        ? [{ value: [{ activo: true, tasa: 18, nombre: 'ITBIS' }] }]
        : [],
    }
    const res = await getPublicRates(deps as any, SLUG, { checkIn: '2026-09-01', checkOut: '2026-09-03' })
    expect(res.body.roomTypes[0].fromPrice).toBe(200)
    expect(res.body.roomTypes[0].taxBreakdown).toEqual([{ name: 'ITBIS', rate: 18, amount: 36 }])
  })
})

// ─── (b) Estadía que cruza dos temporadas ────────────────────────────────────────────────────

describe('/rates — estadía que cruza dos temporadas', () => {
  const scenario: Scenario = {
    assignments: [
      { hotelId: HOTEL_ID, date: '2026-09-01', season: 'baja' },
      { hotelId: HOTEL_ID, date: '2026-09-02', season: 'baja' },
      { hotelId: HOTEL_ID, date: '2026-09-03', season: 'alta' },
      { hotelId: HOTEL_ID, date: '2026-09-04', season: 'alta' },
    ],
    rates: [
      { hotelId: HOTEL_ID, roomType: 'standard', occupancy: 2, season: 'baja', channel: '', price: 80 },
      { hotelId: HOTEL_ID, roomType: 'standard', occupancy: 2, season: 'alta', channel: '', price: 150 },
    ],
  }

  it('suma el precio de CADA noche, no multiplica un precio fijo', async () => {
    const res = await getPublicRates(
      ratesDeps(scenario, '2026-09-01', '2026-09-04') as any,
      SLUG, { checkIn: '2026-09-01', checkOut: '2026-09-04' },
    )
    // Noches: 01 (baja 80) + 02 (baja 80) + 03 (alta 150) = 310.
    // La versión vieja habría dicho 100 × 3 = 300; promediar habría dado 103.33 × 3.
    expect(res.body.roomTypes[0].fromPrice).toBe(310)
  })

  it('la noche del checkout NO se cobra (aunque tenga temporada cara asignada)', async () => {
    const res = await getPublicRates(
      ratesDeps(scenario, '2026-09-01', '2026-09-03') as any,
      SLUG, { checkIn: '2026-09-01', checkOut: '2026-09-03' },
    )
    // Solo 01 + 02 (baja): 160. La noche del 03 (alta, 150) es el día de salida.
    expect(res.body.roomTypes[0].fromPrice).toBe(160)
  })

  it('el override de canal (channel="airbnb") NO se filtra al motor directo', async () => {
    const res = await getPublicRates(
      ratesDeps({
        assignments: [{ hotelId: HOTEL_ID, date: '2026-09-01', season: 'alta' }],
        rates: [
          { hotelId: HOTEL_ID, roomType: 'standard', occupancy: 2, season: 'alta', channel: '', price: 150 },
          { hotelId: HOTEL_ID, roomType: 'standard', occupancy: 2, season: 'alta', channel: 'airbnb', price: 999 },
        ],
      }, '2026-09-01', '2026-09-02') as any,
      SLUG, { checkIn: '2026-09-01', checkOut: '2026-09-02' },
    )
    expect(res.body.roomTypes[0].fromPrice).toBe(150)
  })

  it('ocupación: con ?guests=4 toma la fila de occupancy 4 (per_person), no la de 2', async () => {
    const rooms = [{ id: 'r1', hotelId: HOTEL_ID, type: 'suite', capacity: 4, basePrice: 100, status: 'available' }]
    const res = await getPublicRates(
      ratesDeps({
        rooms,
        assignments: [{ hotelId: HOTEL_ID, date: '2026-09-01', season: 'alta' }],
        rates: [
          { hotelId: HOTEL_ID, roomType: 'suite', occupancy: 2, season: 'alta', channel: '', price: 150 },
          { hotelId: HOTEL_ID, roomType: 'suite', occupancy: 4, season: 'alta', channel: '', price: 260 },
        ],
      }, '2026-09-01', '2026-09-02') as any,
      SLUG, { checkIn: '2026-09-01', checkOut: '2026-09-02', guests: 4 },
    )
    expect(res.body.roomTypes[0].fromPrice).toBe(260)
  })

  it('fila con price=0 se recompone desde basePrice + percentage (misma regla que el calendario)', async () => {
    const res = await getPublicRates(
      ratesDeps({
        assignments: [{ hotelId: HOTEL_ID, date: '2026-09-01', season: 'alta' }],
        rates: [{ hotelId: HOTEL_ID, roomType: 'standard', occupancy: 2, season: 'alta', channel: '', price: 0, basePrice: 200, percentage: 10 }],
      }, '2026-09-01', '2026-09-02') as any,
      SLUG, { checkIn: '2026-09-01', checkOut: '2026-09-02' },
    )
    expect(res.body.roomTypes[0].fromPrice).toBe(220)
  })
})

// ─── (c) Noche con temporada pero sin fila en room_rates ─────────────────────────────────────

describe('/rates — fallback por noche a rooms.basePrice', () => {
  it('noche con temporada asignada pero SIN fila de tarifa → cobra rooms.basePrice esa noche', async () => {
    const res = await getPublicRates(
      ratesDeps({
        assignments: [
          { hotelId: HOTEL_ID, date: '2026-09-01', season: 'alta' },
          // El 02 tiene temporada 'sin-tarifa': no existe fila en room_rates para ella.
          { hotelId: HOTEL_ID, date: '2026-09-02', season: 'sin-tarifa' },
        ],
        rates: [{ hotelId: HOTEL_ID, roomType: 'standard', occupancy: 2, season: 'alta', channel: '', price: 150 }],
      }, '2026-09-01', '2026-09-03') as any,
      SLUG, { checkIn: '2026-09-01', checkOut: '2026-09-03' },
    )
    // 01 (alta 150) + 02 (sin fila → basePrice 100) = 250.
    expect(res.body.roomTypes[0].fromPrice).toBe(250)
  })

  it('temporada con tarifa para OTRO tipo de habitación → el tipo sin tarifa usa su basePrice', async () => {
    const rooms = [
      { id: 'r1', hotelId: HOTEL_ID, type: 'standard', capacity: 2, basePrice: 100, status: 'available' },
      { id: 'r2', hotelId: HOTEL_ID, type: 'suite', capacity: 2, basePrice: 300, status: 'available' },
    ]
    const res = await getPublicRates(
      ratesDeps({
        rooms,
        assignments: [{ hotelId: HOTEL_ID, date: '2026-09-01', season: 'alta' }],
        rates: [{ hotelId: HOTEL_ID, roomType: 'standard', occupancy: 2, season: 'alta', channel: '', price: 150 }],
      }, '2026-09-01', '2026-09-02') as any,
      SLUG, { checkIn: '2026-09-01', checkOut: '2026-09-02' },
    )
    const byType = Object.fromEntries(res.body.roomTypes.map((rt: any) => [rt.id, rt.fromPrice]))
    expect(byType.standard).toBe(150)
    expect(byType.suite).toBe(300) // sin fila para 'suite' → basePrice de la habitación
  })
})

// ─── (d) Coherencia /rates ↔ /calendar ───────────────────────────────────────────────────────

/**
 * Suma los `fromPrice` diarios que devuelve `/calendar` para las NOCHES de la estadía.
 * Las noches de `[checkIn, checkOut)` son las celdas `from=checkIn .. to=checkOut-1` del
 * calendario (que es inclusivo en ambos extremos): la noche del checkout no se cobra.
 */
async function calendarStayTotal(s: Scenario, checkIn: string, checkOut: string, guests?: number): Promise<number> {
  const res = await getPublicCalendar(calendarDeps(s), SLUG, {
    from: checkIn, to: addDays(checkOut, -1), guests,
  })
  expect(res.status).toBe(200)
  return res.body.days.reduce((sum: number, d: any) => sum + d.fromPrice, 0)
}

describe('coherencia: total de /rates == suma de los fromPrice diarios de /calendar', () => {
  const cases: { name: string; s: Scenario; checkIn: string; checkOut: string; guests?: number }[] = [
    {
      name: 'hotel sin temporadas (el caso de casi todos hoy)',
      s: {}, checkIn: '2026-09-01', checkOut: '2026-09-05',
    },
    {
      name: 'estadía que cruza dos temporadas',
      s: {
        assignments: [
          { hotelId: HOTEL_ID, date: '2026-09-01', season: 'baja' },
          { hotelId: HOTEL_ID, date: '2026-09-02', season: 'baja' },
          { hotelId: HOTEL_ID, date: '2026-09-03', season: 'alta' },
          { hotelId: HOTEL_ID, date: '2026-09-04', season: 'alta' },
        ],
        rates: [
          { hotelId: HOTEL_ID, roomType: 'standard', occupancy: 2, season: 'baja', channel: '', price: 80 },
          { hotelId: HOTEL_ID, roomType: 'standard', occupancy: 2, season: 'alta', channel: '', price: 150 },
        ],
      },
      checkIn: '2026-09-01', checkOut: '2026-09-05',
    },
    {
      name: 'temporada sin fila de tarifa (fallback a basePrice en el medio del rango)',
      s: {
        assignments: [
          { hotelId: HOTEL_ID, date: '2026-09-01', season: 'alta' },
          { hotelId: HOTEL_ID, date: '2026-09-02', season: 'sin-tarifa' },
          { hotelId: HOTEL_ID, date: '2026-09-03', season: 'alta' },
        ],
        rates: [{ hotelId: HOTEL_ID, roomType: 'standard', occupancy: 2, season: 'alta', channel: '', price: 150 }],
      },
      checkIn: '2026-09-01', checkOut: '2026-09-04',
    },
    {
      name: 'override de canal presente (ninguno de los dos lo debe tomar)',
      s: {
        assignments: [
          { hotelId: HOTEL_ID, date: '2026-09-01', season: 'alta' },
          { hotelId: HOTEL_ID, date: '2026-09-02', season: 'alta' },
        ],
        rates: [
          { hotelId: HOTEL_ID, roomType: 'standard', occupancy: 2, season: 'alta', channel: '', price: 150 },
          { hotelId: HOTEL_ID, roomType: 'standard', occupancy: 2, season: 'alta', channel: 'booking', price: 999 },
        ],
      },
      checkIn: '2026-09-01', checkOut: '2026-09-03',
    },
    {
      name: 'guests=4 (per_person: los dos resuelven la misma ocupación)',
      s: {
        rooms: [{ id: 'r1', hotelId: HOTEL_ID, type: 'suite', capacity: 4, basePrice: 100, status: 'available' }],
        assignments: [
          { hotelId: HOTEL_ID, date: '2026-09-01', season: 'alta' },
          { hotelId: HOTEL_ID, date: '2026-09-02', season: 'alta' },
        ],
        rates: [
          { hotelId: HOTEL_ID, roomType: 'suite', occupancy: 2, season: 'alta', channel: '', price: 150 },
          { hotelId: HOTEL_ID, roomType: 'suite', occupancy: 4, season: 'alta', channel: '', price: 260 },
        ],
      },
      checkIn: '2026-09-01', checkOut: '2026-09-03', guests: 4,
    },
  ]

  for (const c of cases) {
    it(c.name, async () => {
      const rates = await getPublicRates(
        ratesDeps(c.s, c.checkIn, c.checkOut) as any,
        SLUG, { checkIn: c.checkIn, checkOut: c.checkOut, guests: c.guests },
      )
      expect(rates.status).toBe(200)
      // `/calendar` publica el `fromPrice` = el tipo MÁS BARATO del día; en estos escenarios
      // hay un solo tipo vendible, así que se compara contra el total de ese tipo en `/rates`.
      const cheapest = Math.min(...rates.body.roomTypes.map((rt: any) => rt.fromPrice))
      const fromCalendar = await calendarStayTotal(c.s, c.checkIn, c.checkOut, c.guests)
      expect(cheapest).toBe(fromCalendar)
    })
  }
})
