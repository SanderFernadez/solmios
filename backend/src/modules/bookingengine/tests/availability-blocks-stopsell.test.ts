// bookingengine/tests/availability-blocks-stopsell.test.ts
//
// El motor de reservas público VENDÍA lo que el hotel ya había cerrado. Dos caras del mismo bug:
//
//  (A) `room_blocks` — `AvailabilityUseCase` calculaba `rooms − reservations` y NUNCA consultaba
//      la tabla de bloqueos. El push ARI a Channex sí los respeta y `/calendar` también, así que
//      una habitación bloqueada por mantenimiento quedaba CERRADA en Booking/Airbnb y ABIERTA en
//      la web propia del hotel.
//  (B) `room_rates.closed` — el calendario pintaba el día cerrado, pero `/rates` seguía cotizando
//      ese tipo y `POST /api/public/booking` aceptaba la reserva.
//
// Este archivo ancla las dos reglas en el motor y, sobre todo, la INVARIANTE que las une:
// lo que `/calendar` pinta cerrado no se cotiza en `/rates`, y viceversa.
import { describe, it, expect } from 'bun:test'
import type { CacheAdapter } from 'arckode-framework'
import { AvailabilityUseCase } from '../usecases/availability'
import { getPublicRates } from '../usecases/public-rates'
import { getPublicCalendar } from '../usecases/public-calendar'
import { addDays, eachDayExclusive } from '../../../shared/utils/daily-availability'

const HOTEL_ID = 'h1'
const SLUG = 'caribe-paradise'

const noCache = { get: async () => null, set: async () => {} } as unknown as CacheAdapter

const HOTEL = { id: HOTEL_ID, name: 'Caribe Paradise', slug: SLUG, onlineBookingStatus: 'active', currency: 'USD' }

/** Un standard (dos unidades) y una suite. Todas entran 2 huéspedes. */
const ROOMS = [
  { id: 'r1', hotelId: HOTEL_ID, type: 'standard', capacity: 2, basePrice: 100, status: 'available' },
  { id: 'r2', hotelId: HOTEL_ID, type: 'standard', capacity: 2, basePrice: 110, status: 'available' },
  { id: 'r3', hotelId: HOTEL_ID, type: 'suite', capacity: 2, basePrice: 200, status: 'available' },
]

interface Scenario {
  rooms?: any[]
  reservations?: any[]
  blocks?: any[]
  assignments?: any[]
  rates?: any[]
  /** `false` → no se cablean los repos nuevos (compat con callers/tests viejos). */
  wired?: boolean
}

const repo = (rows: any[]) => ({
  findMany: async (_f?: any) => rows,
  findOne: async (_f?: any) => rows[0] ?? null,
}) as any

function makeUseCase(s: Scenario): AvailabilityUseCase {
  const hotels = { findOne: async () => HOTEL } as any
  if (s.wired === false) {
    return new AvailabilityUseCase(noCache, repo(s.rooms ?? ROOMS), repo(s.reservations ?? []), hotels)
  }
  return new AvailabilityUseCase(
    noCache,
    repo(s.rooms ?? ROOMS), repo(s.reservations ?? []), hotels,
    repo(s.blocks ?? []), repo(s.assignments ?? []), repo(s.rates ?? []),
  )
}

const check = (s: Scenario, checkIn: string, checkOut: string, adults = 2) =>
  makeUseCase(s).check({ hotelId: HOTEL_ID, checkIn, checkOut, adults } as any)

const availableOf = (r: any, type: string): number =>
  r.roomTypes.find((t: any) => t.roomType === type)?.available ?? 0
const totalOf = (r: any): number => r.roomTypes.reduce((s: number, t: any) => s + t.available, 0)

const block = (roomId: string, startDate: string, endDate: string) =>
  ({ id: `b-${roomId}-${startDate}`, hotelId: HOTEL_ID, roomId, reason: 'mantenimiento', startDate, endDate })

// ─── (A) room_blocks ─────────────────────────────────────────────────────────────────────────
//
// Estadía de referencia: 2026-09-10 → 2026-09-13. Noches REALES: 10, 11 y 12 (la del 13 no
// existe: el huésped se va esa mañana).

const IN = '2026-09-10'
const OUT = '2026-09-13'

describe('AvailabilityUseCase — room_blocks (bloqueos de mantenimiento)', () => {
  it('una habitación con un bloqueo que solapa el rango NO se ofrece', async () => {
    const r = await check({ blocks: [block('r1', '2026-09-09', '2026-09-11')] }, IN, OUT)
    expect(availableOf(r, 'standard')).toBe(1) // r2 sigue libre
    expect(totalOf(r)).toBe(2)                 // r2 + r3
  })

  it('un bloqueo que NO solapa el rango no afecta la disponibilidad', async () => {
    const r = await check({ blocks: [block('r1', '2026-09-01', '2026-09-05')] }, IN, OUT)
    expect(availableOf(r, 'standard')).toBe(2)
    expect(totalOf(r)).toBe(3)
  })

  it('un bloqueo en el MEDIO de la estadía la invalida entera (no se vende media estadía)', async () => {
    const r = await check({ blocks: [block('r1', '2026-09-11', '2026-09-11')] }, IN, OUT)
    expect(availableOf(r, 'standard')).toBe(1)
  })

  it('BORDE — `endDate` es INCLUSIVO: un bloqueo que termina el día del check-in bloquea esa noche', async () => {
    // El bloqueo cubre 08, 09 y 10. La noche del 10 es la primera de la estadía → ocupada.
    const r = await check({ blocks: [block('r1', '2026-09-08', IN)] }, IN, OUT)
    expect(availableOf(r, 'standard')).toBe(1)
  })

  it('BORDE — un bloqueo que termina la VÍSPERA del check-in no bloquea nada', async () => {
    const r = await check({ blocks: [block('r1', '2026-09-08', '2026-09-09')] }, IN, OUT)
    expect(availableOf(r, 'standard')).toBe(2)
  })

  it('BORDE — un bloqueo que empieza el día del CHECKOUT no bloquea: esa noche no se vende', async () => {
    // Igual que una reserva que entra el 13: la noche del 13 no forma parte de la estadía.
    const r = await check({ blocks: [block('r1', OUT, '2026-09-20')] }, IN, OUT)
    expect(availableOf(r, 'standard')).toBe(2)
  })

  it('BORDE — un bloqueo que empieza la última noche (checkout − 1) SÍ bloquea', async () => {
    const r = await check({ blocks: [block('r1', '2026-09-12', '2026-09-20')] }, IN, OUT)
    expect(availableOf(r, 'standard')).toBe(1)
  })

  it('si TODAS las unidades del tipo están bloqueadas, el tipo desaparece de la respuesta', async () => {
    const r = await check({
      blocks: [block('r1', '2026-09-09', '2026-09-11'), block('r2', '2026-09-12', '2026-09-12')],
    }, IN, OUT)
    expect(r.roomTypes.map((t: any) => t.roomType)).toEqual(['suite'])
  })

  it('un bloqueo se suma a las reservas: los dos descuentan unidades', async () => {
    const r = await check({
      blocks: [block('r1', '2026-09-11', '2026-09-11')],
      reservations: [{ roomId: 'r2', status: 'confirmed', checkIn: '2026-09-09', checkOut: '2026-09-11' }],
    }, IN, OUT)
    expect(availableOf(r, 'standard')).toBe(0)
    expect(r.roomTypes.map((t: any) => t.roomType)).toEqual(['suite'])
  })

  it('una fila de bloqueo corrupta (sin roomId o sin fechas) se ignora, no rompe el motor', async () => {
    const r = await check({
      blocks: [
        { id: 'b-x', hotelId: HOTEL_ID, roomId: '', startDate: '2026-09-10', endDate: '2026-09-12' },
        { id: 'b-y', hotelId: HOTEL_ID, roomId: 'r1', startDate: '', endDate: '' },
      ],
    }, IN, OUT)
    expect(totalOf(r)).toBe(3)
  })

  it('COMPAT — sin los repos nuevos cableados, el motor se comporta como antes del fix', async () => {
    const r = await check({ wired: false, blocks: [block('r1', '2026-09-09', '2026-09-11')] }, IN, OUT)
    expect(totalOf(r)).toBe(3) // los bloqueos ni se leen: comportamiento previo intacto
  })
})

// ─── (B) room_rates.closed (stop-sell) ───────────────────────────────────────────────────────

/** Temporada 'alta' pintada sobre todo septiembre — así cada noche resuelve a una fila de tarifa. */
const SEPTEMBER = eachDayExclusive('2026-09-01', '2026-10-01')
  .map((date) => ({ hotelId: HOTEL_ID, date, season: 'alta' }))

/** Temporada por día, para cerrar UNA noche puntual sin tocar el resto del mes. */
const seasonPerNight = (closedDate: string) =>
  SEPTEMBER.map((a) => (a.date === closedDate ? { ...a, season: 'cerrada' } : a))

const rate = (roomType: string, season: string, price: number, closed = 0) =>
  ({ hotelId: HOTEL_ID, roomType, occupancy: 2, season, channel: '', price, closed })

describe('AvailabilityUseCase — room_rates.closed (stop-sell)', () => {
  it('un tipo con `closed=1` en UNA noche del rango no se cotiza para el rango completo', async () => {
    const r = await check({
      assignments: seasonPerNight('2026-09-11'),
      rates: [
        rate('standard', 'alta', 150), rate('standard', 'cerrada', 150, 1),
        rate('suite', 'alta', 300), rate('suite', 'cerrada', 300),
      ],
    }, IN, OUT)
    // standard cerrado la noche del 11 → fuera, aunque le queden DOS unidades libres.
    expect(r.roomTypes.map((t: any) => t.roomType)).toEqual(['suite'])
  })

  it('un tipo con `closed=1` FUERA del rango sí se cotiza', async () => {
    const r = await check({
      assignments: seasonPerNight('2026-09-20'),
      rates: [
        rate('standard', 'alta', 150), rate('standard', 'cerrada', 150, 1),
        rate('suite', 'alta', 300), rate('suite', 'cerrada', 300),
      ],
    }, IN, OUT)
    expect(r.roomTypes.map((t: any) => t.roomType).sort()).toEqual(['standard', 'suite'])
  })

  it('BORDE — `closed=1` en la noche del CHECKOUT no cierra nada: esa noche no se vende', async () => {
    const r = await check({
      assignments: seasonPerNight(OUT),
      rates: [
        rate('standard', 'alta', 150), rate('standard', 'cerrada', 150, 1),
        rate('suite', 'alta', 300), rate('suite', 'cerrada', 300),
      ],
    }, IN, OUT)
    expect(availableOf(r, 'standard')).toBe(2)
  })

  it('BORDE — `closed=1` en la ÚLTIMA noche real (checkout − 1) sí cierra el tipo', async () => {
    const r = await check({
      assignments: seasonPerNight('2026-09-12'),
      rates: [
        rate('standard', 'alta', 150), rate('standard', 'cerrada', 150, 1),
        rate('suite', 'alta', 300), rate('suite', 'cerrada', 300),
      ],
    }, IN, OUT)
    expect(r.roomTypes.map((t: any) => t.roomType)).toEqual(['suite'])
  })

  it('el stop-sell de un override de CANAL (airbnb) NO cierra el motor directo', async () => {
    const r = await check({
      assignments: SEPTEMBER,
      rates: [
        rate('standard', 'alta', 150),
        { hotelId: HOTEL_ID, roomType: 'standard', occupancy: 2, season: 'alta', channel: 'airbnb', price: 150, closed: 1 },
      ],
    }, IN, OUT)
    expect(availableOf(r, 'standard')).toBe(2)
  })

  it('`closed=0` (o ausente) no cierra nada', async () => {
    const r = await check({
      assignments: SEPTEMBER,
      rates: [rate('standard', 'alta', 150), { hotelId: HOTEL_ID, roomType: 'suite', occupancy: 2, season: 'alta', channel: '', price: 300 }],
    }, IN, OUT)
    expect(totalOf(r)).toBe(3)
  })

  it('si TODOS los tipos están cerrados, no hay nada que cotizar', async () => {
    const r = await check({
      assignments: seasonPerNight('2026-09-11'),
      rates: [
        rate('standard', 'alta', 150), rate('standard', 'cerrada', 150, 1),
        rate('suite', 'alta', 300), rate('suite', 'cerrada', 300, 1),
      ],
    }, IN, OUT)
    expect(r.roomTypes).toEqual([])
  })

  it('COMPAT — sin los repos nuevos cableados, el stop-sell ni se lee (comportamiento previo)', async () => {
    const r = await check({
      wired: false,
      assignments: seasonPerNight('2026-09-11'),
      rates: [rate('standard', 'cerrada', 150, 1)],
    }, IN, OUT)
    expect(totalOf(r)).toBe(3)
  })
})

// ─── (C) INVARIANTE /calendar ↔ /rates ───────────────────────────────────────────────────────
//
// La regla que este cambio existe para sostener: si el calendario dice que un día del rango está
// cerrado, `/rates` no puede cotizar NADA para un rango que lo incluya; y si `/rates` cotiza algo,
// ninguna noche del rango puede estar cerrada en el calendario. Vale en los dos sentidos y para
// las DOS causas (bloqueo y stop-sell).

const ratesDeps = (s: Scenario) => ({
  hotels: { findOne: async () => HOTEL } as any,
  // Availability REAL (no un mock): es justamente el usecase que este cambio toca.
  availability: { checkAvailability: (q: any) => makeUseCase(s).check(q) },
  config: { findMany: async () => [] } as any,
  seasonAssignments: repo(s.assignments ?? []),
  roomRates: repo(s.rates ?? []),
}) as any

const calendarDeps = (s: Scenario) => ({
  hotels: { findOne: async () => HOTEL } as any,
  rooms: repo(s.rooms ?? ROOMS),
  reservations: repo(s.reservations ?? []),
  roomBlocks: repo(s.blocks ?? []),
  seasonAssignments: repo(s.assignments ?? []),
  roomRates: repo(s.rates ?? []),
  config: { findMany: async () => [] } as any,
}) as any

/** Días `closed` que `/calendar` reporta para las NOCHES de `[checkIn, checkOut)`. */
async function closedNights(s: Scenario, checkIn: string, checkOut: string): Promise<string[]> {
  // Las noches de la estadía son las celdas `from=checkIn .. to=checkOut-1` del calendario
  // (que es inclusivo en ambos extremos): la noche del checkout no se vende.
  const res = await getPublicCalendar(calendarDeps(s), SLUG, { from: checkIn, to: addDays(checkOut, -1) })
  expect(res.status).toBe(200)
  return res.body.days.filter((d: any) => d.closed).map((d: any) => d.date)
}

describe('INVARIANTE — lo que /calendar pinta cerrado, /rates no lo cotiza', () => {
  const cases: { name: string; s: Scenario; expectClosed: boolean }[] = [
    {
      name: 'BLOQUEO total: todas las unidades del hotel bloqueadas una noche del rango',
      s: {
        blocks: [block('r1', '2026-09-11', '2026-09-11'), block('r2', '2026-09-11', '2026-09-11'), block('r3', '2026-09-11', '2026-09-11')],
      },
      expectClosed: true,
    },
    {
      name: 'BLOQUEO parcial: solo el standard queda sin unidades esa noche (la suite salva el día)',
      s: {
        blocks: [block('r1', '2026-09-11', '2026-09-11'), block('r2', '2026-09-11', '2026-09-11')],
      },
      expectClosed: false,
    },
    {
      name: 'BLOQUEO fuera del rango: no cierra nada',
      s: {
        blocks: [block('r1', '2026-09-20', '2026-09-25'), block('r2', '2026-09-20', '2026-09-25'), block('r3', '2026-09-20', '2026-09-25')],
      },
      expectClosed: false,
    },
    {
      name: 'STOP-SELL total: los dos tipos con closed=1 una noche del rango',
      s: {
        assignments: seasonPerNight('2026-09-11'),
        rates: [
          rate('standard', 'alta', 150), rate('standard', 'cerrada', 150, 1),
          rate('suite', 'alta', 300), rate('suite', 'cerrada', 300, 1),
        ],
      },
      expectClosed: true,
    },
    {
      name: 'STOP-SELL parcial: solo el standard cerrado (la suite sigue vendible)',
      s: {
        assignments: seasonPerNight('2026-09-11'),
        rates: [
          rate('standard', 'alta', 150), rate('standard', 'cerrada', 150, 1),
          rate('suite', 'alta', 300), rate('suite', 'cerrada', 300),
        ],
      },
      expectClosed: false,
    },
    {
      name: 'STOP-SELL fuera del rango: no cierra nada',
      s: {
        assignments: seasonPerNight('2026-09-20'),
        rates: [
          rate('standard', 'alta', 150), rate('standard', 'cerrada', 150, 1),
          rate('suite', 'alta', 300), rate('suite', 'cerrada', 300, 1),
        ],
      },
      expectClosed: false,
    },
    {
      name: 'MIXTO: bloqueo del standard + stop-sell de la suite la misma noche → nada vendible',
      s: {
        blocks: [block('r1', '2026-09-11', '2026-09-11'), block('r2', '2026-09-11', '2026-09-11')],
        assignments: seasonPerNight('2026-09-11'),
        rates: [
          rate('standard', 'alta', 150), rate('standard', 'cerrada', 150),
          rate('suite', 'alta', 300), rate('suite', 'cerrada', 300, 1),
        ],
      },
      expectClosed: true,
    },
    {
      name: 'hotel sin bloqueos ni stop-sell (el caso de casi todos hoy)',
      s: {},
      expectClosed: false,
    },
  ]

  for (const c of cases) {
    it(c.name, async () => {
      const closed = await closedNights(c.s, IN, OUT)
      const rates = await getPublicRates(ratesDeps(c.s), SLUG, { checkIn: IN, checkOut: OUT })
      expect(rates.status).toBe(200)

      expect(closed.length > 0).toBe(c.expectClosed)
      // La invariante, en los dos sentidos: hay noche cerrada ⟺ `/rates` no cotiza nada.
      expect(rates.body.roomTypes.length === 0).toBe(closed.length > 0)
    })
  }

  it('un tipo cotizado por /rates tiene unidades libres TODAS las noches en /calendar', async () => {
    // Stop-sell parcial: la suite se cotiza, el standard no. El calendario tiene que mostrar
    // stock ese día (el de la suite), no cero.
    const s: Scenario = {
      assignments: seasonPerNight('2026-09-11'),
      rates: [
        rate('standard', 'alta', 150), rate('standard', 'cerrada', 150, 1),
        rate('suite', 'alta', 300), rate('suite', 'cerrada', 300),
      ],
    }
    const rates = await getPublicRates(ratesDeps(s), SLUG, { checkIn: IN, checkOut: OUT })
    expect(rates.body.roomTypes.map((rt: any) => rt.id)).toEqual(['suite'])

    const cal = await getPublicCalendar(calendarDeps(s), SLUG, { from: IN, to: addDays(OUT, -1) })
    for (const day of cal.body.days) {
      expect(day.closed).toBe(false)
      expect(day.available).toBeGreaterThan(0)
    }
    // La noche cerrada para el standard muestra SOLO la unidad de la suite.
    expect(cal.body.days.find((d: any) => d.date === '2026-09-11').available).toBe(1)
  })
})
