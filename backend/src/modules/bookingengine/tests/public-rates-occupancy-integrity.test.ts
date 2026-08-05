// bookingengine/tests/public-rates-occupancy-integrity.test.ts
//
// La matriz de ocupaciones de `GET /api/public/hotels/:slug/rates` no es decoración: el frontend
// pinta en gris la fila que viaja con `available:false` y **cobra el precio de la fila elegida**.
// Este archivo ancla los cinco agujeros que un QA adversarial encontró entre lo que la matriz
// PUBLICA y lo que el motor realmente HACE.
//
//  (1) `no_rate` FALSO — la grilla de ocupaciones se armaba con TODAS las filas de `room_rates`
//      del tipo, sin filtrar por temporada, mientras el precio se resolvía POR temporada (con
//      fallback a `rooms.basePrice`). El mismo body decía `fromPrice: 160, availableCount: 2` y
//      `{occupancy:3, price:0, unavailableReason:'no_rate'}` — y el POST aceptaba esa reserva.
//  (2) AMPLIFICACIÓN DE CPU — `maxNights` sale de `booking_config` y su default es `Infinity`:
//      un rango de 10 años en una ruta pública sin auth pasó de 19 ms a 740 ms medidos.
//  (3) EL PRECIO PUBLICADO NO ES EL QUE SE COBRA — el POST cobraba `basePrice × noches`,
//      ignorando temporada Y ocupación, mientras la matriz publicaba un precio por ocupación.
//  (4) EL TIPO ENTERO DESAPARECÍA justo cuando la fila gris hace falta: buscando para 4, con la
//      única unidad de 4 tomada, no se veía ni la fila gris de 4 ni las de 1/2/3 que sí estaban.
//  (5) `countByOccupancy` iteraba hasta `capacity` sin techo, con el guard solo del lado del
//      consumidor de la matriz.
import { describe, it, expect } from 'bun:test'
import type { CacheAdapter } from 'arckode-framework'
import { getPublicRates } from '../usecases/public-rates'
import { createPublicBookingDirect } from '../usecases/public-booking'
import { AvailabilityUseCase } from '../usecases/availability'
import { MAX_STAY_NIGHTS } from '../validators/schema'
import { MAX_OCCUPANCY_ROWS } from '../usecases/occupancy-matrix'
import type { AvailabilityResult } from '../types'

const HOTEL_ID = 'h1'
const SLUG = 'caribe-paradise'
const HOTEL = {
  id: HOTEL_ID, name: 'Caribe Paradise', slug: SLUG,
  onlineBookingStatus: 'active', currency: 'USD', taxRate: 0,
}

const noCache = { get: async () => null, set: async () => {} } as unknown as CacheAdapter

const repo = (rows: any[]) => ({
  findMany: async (_f?: any) => rows,
  findOne: async (_f?: any) => rows[0] ?? null,
}) as any

const rowFor = (body: any, type: string, occupancy: number) =>
  body.roomTypes.find((t: any) => t.id === type)!
    .occupancies.find((o: any) => o.occupancy === occupancy)

/** `orm` mínimo para `createPublicBookingDirect` (mismo molde que public-booking-blocks-stopsell). */
function makeOrm(opts: { rooms?: any[]; rates?: any[]; assignments?: any[] } = {}) {
  const rooms = opts.rooms ?? []
  const created: any[] = []
  const orm: any = {
    findById: async (model: string, id: string) =>
      (model === 'Rooms' ? rooms.find((r) => r.id === id) ?? null : null),
    findMany: async (model: string, filters?: any) => {
      if (model === 'Rooms') {
        return rooms.filter((r) =>
          (!filters?.hotelId || r.hotelId === filters.hotelId) &&
          (!filters?.type || r.type === filters.type))
      }
      if (model === 'RoomRates') return opts.rates ?? []
      if (model === 'SeasonAssignments') return opts.assignments ?? []
      return []
    },
    create: async (model: string, payload: any) => {
      const row = { id: payload.id || crypto.randomUUID(), ...payload }
      created.push({ model, row })
      return row
    },
    transaction: async (cb: (tx: any) => Promise<any>) => cb(orm),
    update: async () => null,
    findOne: async () => null,
  }
  return { orm, created }
}

// ─── (1) `no_rate` no puede contradecir al precio que el mismo body publica ──────────────────
//
// Escenario EXACTO del hallazgo: el tipo tiene UNA fila de tarifa, `occupancy: 2`, de la
// temporada 'alta'. Se consulta para fechas que NO tienen ninguna asignación de temporada, con
// `guests=3`. Esas noches cotizan por el fallback `rooms.basePrice`, que no distingue ocupaciones.

describe('/rates — `no_rate` se decide contra las temporadas de ESAS fechas', () => {
  const IN = '2026-11-10'
  const OUT = '2026-11-12' // 2 noches: 10 y 11, SIN season_assignment.

  /** La única tarifa del hotel es de 'alta', una temporada que no toca este rango. */
  const OTHER_SEASON_RATE = [
    { hotelId: HOTEL_ID, roomType: 'familiar', occupancy: 2, season: 'alta', channel: '', price: 200, closed: 0 },
  ]
  /** 'alta' existe en el calendario del hotel, pero en OTRAS fechas. */
  const ASSIGNMENTS_ELSEWHERE = [
    { hotelId: HOTEL_ID, date: '2026-12-24', season: 'alta' },
    { hotelId: HOTEL_ID, date: '2026-12-25', season: 'alta' },
  ]

  const ROOMS = [
    { id: 'r1', hotelId: HOTEL_ID, type: 'familiar', capacity: 3, basePrice: 80, status: 'available' },
    { id: 'r2', hotelId: HOTEL_ID, type: 'familiar', capacity: 3, basePrice: 80, status: 'available' },
  ]

  const ratesDeps = () => ({
    hotels: { findOne: async () => HOTEL } as any,
    availability: {
      checkAvailability: (q: any) => new AvailabilityUseCase(
        noCache, repo(ROOMS), repo([]), { findOne: async () => HOTEL } as any,
        repo([]), repo(ASSIGNMENTS_ELSEWHERE), repo(OTHER_SEASON_RATE),
      ).check(q),
    },
    config: { findMany: async () => [] } as any,
    seasonAssignments: repo(ASSIGNMENTS_ELSEWHERE),
    roomRates: repo(OTHER_SEASON_RATE),
  }) as any

  it('una fila de OTRA temporada no vuelve `no_rate` a una ocupación que el motor sí cotiza', async () => {
    const res = await getPublicRates(ratesDeps(), SLUG, { checkIn: IN, checkOut: OUT, guests: 3 })
    expect(res.status).toBe(200)

    const rt = res.body.roomTypes[0]
    // Lo que el mismo body afirma por el otro lado: hay stock y hay precio para 3 huéspedes.
    expect(rt.availableCount).toBe(2)
    expect(rt.fromPrice).toBe(160) // 80 × 2 noches, por el fallback `rooms.basePrice`.

    const row3 = rowFor(res.body, 'familiar', 3)
    // LA REGRESIÓN: la fila NO puede reclamar "falta la tarifa" de algo que se está cotizando.
    expect(row3.unavailableReason).not.toBe('no_rate')
    expect(row3).toMatchObject({ available: true, unavailableReason: null, price: 160, pricePerNight: 80 })
  })

  it('la fila gris no puede ser una venta que el POST sí acepta (coherencia GET ↔ POST)', async () => {
    const res = await getPublicRates(ratesDeps(), SLUG, { checkIn: IN, checkOut: OUT, guests: 3 })
    const row3 = rowFor(res.body, 'familiar', 3)

    const { orm } = makeOrm({ rooms: ROOMS, rates: OTHER_SEASON_RATE, assignments: ASSIGNMENTS_ELSEWHERE })
    const booking = await createPublicBookingDirect(orm, {
      hotelId: HOTEL_ID, roomType: 'familiar', guestName: 'Ana', guestEmail: 'ana@example.com',
      checkIn: IN, checkOut: OUT, adults: 3, children: 0,
    })

    // El motor sirve la reserva → la matriz tiene que haberla ofrecido, y al mismo precio.
    expect(booking.status).toBe(201)
    expect(row3.available).toBe(true)
    expect(booking.body.totalBreakdown.subtotal).toBe(row3.price)
  })

  it('con la temporada SÍ asignada al rango, la ocupación sin fila sigue siendo `no_rate`', async () => {
    // Control negativo: el fix no puede haber apagado el motivo legítimo. Mismas tarifas, pero
    // ahora las dos noches pertenecen a 'alta', que solo tiene fila para 2 → "para 3" no existe.
    const assignments = [
      { hotelId: HOTEL_ID, date: IN, season: 'alta' },
      { hotelId: HOTEL_ID, date: '2026-11-11', season: 'alta' },
    ]
    const deps = {
      hotels: { findOne: async () => HOTEL } as any,
      availability: {
        checkAvailability: async (): Promise<AvailabilityResult> => ({
          hotelId: HOTEL_ID, hotelName: 'Caribe Paradise', checkIn: IN, checkOut: OUT, nights: 2,
          roomTypes: [{
            roomType: 'familiar', available: 2, price: 80, currency: 'USD',
            capacity: 3, surfaceArea: 0, amenities: [], availableByOccupancy: [2, 2, 2],
          }],
        }),
      },
      config: { findMany: async () => [] } as any,
      seasonAssignments: repo(assignments),
      roomRates: repo(OTHER_SEASON_RATE),
    } as any
    const res = await getPublicRates(deps, SLUG, { checkIn: IN, checkOut: OUT, guests: 3 })
    expect(rowFor(res.body, 'familiar', 3)).toMatchObject({
      available: false, unavailableReason: 'no_rate', price: 0,
    })
  })

  it('BORDE — alcanza UNA noche con grilla que no cubre para que la ocupación sea `no_rate`', async () => {
    // Una estadía es atómica: si el hotel cargó grilla para la noche del medio y ninguna fila
    // llega a 3 personas, esa ocupación no se puede vender aunque las otras noches caigan al
    // fallback. Mismo criterio que el stop-sell parcial.
    const assignments = [{ hotelId: HOTEL_ID, date: '2026-11-11', season: 'alta' }]
    const deps = {
      hotels: { findOne: async () => HOTEL } as any,
      availability: {
        checkAvailability: async (): Promise<AvailabilityResult> => ({
          hotelId: HOTEL_ID, hotelName: 'Caribe Paradise', checkIn: IN, checkOut: OUT, nights: 2,
          roomTypes: [{
            roomType: 'familiar', available: 2, price: 80, currency: 'USD',
            capacity: 3, surfaceArea: 0, amenities: [], availableByOccupancy: [2, 2, 2],
          }],
        }),
      },
      config: { findMany: async () => [] } as any,
      seasonAssignments: repo(assignments),
      roomRates: repo(OTHER_SEASON_RATE),
    } as any
    const res = await getPublicRates(deps, SLUG, { checkIn: IN, checkOut: OUT, guests: 3 })
    expect(rowFor(res.body, 'familiar', 3)).toMatchObject({ available: false, unavailableReason: 'no_rate' })
    // La ocupación 2 sí se cubre esa noche → sigue vendible.
    expect(rowFor(res.body, 'familiar', 2)).toMatchObject({ available: true })
  })
})

// ─── (2) techo duro de noches en la ruta pública sin auth ────────────────────────────────────

describe('/rates — el rango tiene un techo del sistema, no de la config del hotel', () => {
  const deps = (bookingConfig?: any) => ({
    hotels: { findOne: async () => HOTEL } as any,
    availability: {
      checkAvailability: async (): Promise<AvailabilityResult> => {
        throw new Error('no se debe llegar a calcular disponibilidad con un rango excesivo')
      },
    },
    config: { findMany: async () => [] } as any,
    ...(bookingConfig ? { bookingConfig: { findOne: async () => bookingConfig } as any } : {}),
  }) as any

  it('un rango de 10 años se rechaza con 400 ANTES de construir la matriz', async () => {
    const res = await getPublicRates(deps(), SLUG, { checkIn: '2026-01-01', checkOut: '2036-01-01' })
    expect(res.status).toBe(400)
    expect(res.body.error).toBe(`La estadía no puede superar ${MAX_STAY_NIGHTS} noches`)
  })

  it('el default `maxNights: Infinity` de booking_config ya no deja pasar cualquier rango', async () => {
    // `enabled: true` sin `maxNights`: exactamente la fila que tiene un hotel que nunca tocó
    // la pantalla de límites de estadía. Antes de este techo, esto cotizaba 3650 noches.
    const res = await getPublicRates(deps({ hotelId: HOTEL_ID, enabled: true }), SLUG, {
      checkIn: '2026-01-01', checkOut: '2036-01-01',
    })
    expect(res.status).toBe(400)
    expect(res.body.error).toBe(`La estadía no puede superar ${MAX_STAY_NIGHTS} noches`)
  })

  it('la política del hotel sigue mandando cuando es MÁS restrictiva que el techo', async () => {
    const res = await getPublicRates(deps({ hotelId: HOTEL_ID, enabled: true, maxNights: 14 }), SLUG, {
      checkIn: '2026-01-01', checkOut: '2036-01-01',
    })
    expect(res.status).toBe(400)
    expect(res.body.error).toBe('Estadía máxima: 14 noches')
  })

  it('el POST no reabre la amplificación que el GET cerró', async () => {
    const { orm, created } = makeOrm({
      rooms: [{ id: 'r1', hotelId: HOTEL_ID, type: 'standard', basePrice: 100, status: 'available' }],
    })
    const res = await createPublicBookingDirect(orm, {
      hotelId: HOTEL_ID, roomType: 'standard', guestName: 'Ana', guestEmail: 'ana@example.com',
      checkIn: '2026-01-01', checkOut: '2036-01-01', adults: 2,
    })
    expect(res.status).toBe(400)
    expect(created).toHaveLength(0)
  })

  it('el rango máximo permitido sigue cotizando (el techo no se pasa de restrictivo)', async () => {
    const okDeps = {
      hotels: { findOne: async () => HOTEL } as any,
      availability: {
        checkAvailability: async (): Promise<AvailabilityResult> => ({
          hotelId: HOTEL_ID, hotelName: 'Caribe Paradise',
          checkIn: '2026-01-01', checkOut: '2026-04-01', nights: MAX_STAY_NIGHTS,
          roomTypes: [{
            roomType: 'standard', available: 1, price: 10, currency: 'USD',
            capacity: 2, surfaceArea: 0, amenities: [], availableByOccupancy: [1, 1],
          }],
        }),
      },
      config: { findMany: async () => [] } as any,
    } as any
    // 2026-01-01 → 2026-04-01 son exactamente 90 noches.
    const res = await getPublicRates(okDeps, SLUG, { checkIn: '2026-01-01', checkOut: '2026-04-01' })
    expect(res.status).toBe(200)
    expect(res.body.nights).toBe(MAX_STAY_NIGHTS)
  })
})

// ─── (3) el precio publicado es el que se cobra ──────────────────────────────────────────────

describe('POST /api/public/booking — cobra con el MISMO resolver que publica /rates', () => {
  const IN = '2026-09-01'
  const OUT = '2026-09-03' // 2 noches: 01 y 02.

  const bookingBody = (adults: number) => ({
    hotelId: HOTEL_ID, roomType: 'suite', guestName: 'Ana', guestEmail: 'ana@example.com',
    checkIn: IN, checkOut: OUT, adults, children: 0,
  })

  const SUITE = [{ id: 'r1', hotelId: HOTEL_ID, type: 'suite', capacity: 4, basePrice: 100, status: 'available' }]

  it('REGRESIÓN DE PLATA — hotel sin temporadas ni tarifas cobra exactamente lo mismo que antes', async () => {
    // Este es el caso real de casi todos los hoteles hoy: `basePrice × noches`, sin una sola
    // fila de `room_rates` ni de `season_assignments`. Es lo que NO se puede mover.
    for (const adults of [1, 2, 3, 4]) {
      const { orm } = makeOrm({ rooms: SUITE })
      const res = await createPublicBookingDirect(orm, bookingBody(adults))
      expect(res.status).toBe(201)
      expect(res.body.totalBreakdown.subtotal).toBe(200) // 100 × 2 noches, idéntico a la versión vieja
      expect(res.body.reservation.totalAmount).toBe(200)
    }
  })

  const ASSIGNMENTS = [
    { hotelId: HOTEL_ID, date: '2026-09-01', season: 'baja' },
    { hotelId: HOTEL_ID, date: '2026-09-02', season: 'alta' },
  ]
  const RATES = [
    { hotelId: HOTEL_ID, roomType: 'suite', occupancy: 2, season: 'baja', channel: '', price: 90, closed: 0 },
    { hotelId: HOTEL_ID, roomType: 'suite', occupancy: 4, season: 'baja', channel: '', price: 150, closed: 0 },
    { hotelId: HOTEL_ID, roomType: 'suite', occupancy: 2, season: 'alta', channel: '', price: 120, closed: 0 },
    { hotelId: HOTEL_ID, roomType: 'suite', occupancy: 4, season: 'alta', channel: '', price: 200, closed: 0 },
  ]

  const ratesDeps = () => ({
    hotels: { findOne: async () => HOTEL } as any,
    availability: {
      checkAvailability: async (): Promise<AvailabilityResult> => ({
        hotelId: HOTEL_ID, hotelName: 'Caribe Paradise', checkIn: IN, checkOut: OUT, nights: 2,
        roomTypes: [{
          roomType: 'suite', available: 1, price: 100, currency: 'USD',
          capacity: 4, surfaceArea: 0, amenities: [], availableByOccupancy: [1, 1, 1, 1],
        }],
      }),
    },
    config: { findMany: async () => [] } as any,
    seasonAssignments: repo(ASSIGNMENTS),
    roomRates: repo(RATES),
  }) as any

  it('con tarifas cargadas cobra EXACTAMENTE lo que la matriz publicó, ocupación por ocupación', async () => {
    const rates = await getPublicRates(ratesDeps(), SLUG, { checkIn: IN, checkOut: OUT })
    // La matriz publica un precio DISTINTO por ocupación: 1 y 2 pagan la fila de 2, 3 y 4 la de 4.
    expect(rowFor(rates.body, 'suite', 2).price).toBe(210) // 90 (baja) + 120 (alta)
    expect(rowFor(rates.body, 'suite', 4).price).toBe(350) // 150 (baja) + 200 (alta)

    for (const adults of [1, 2, 3, 4]) {
      const published = rowFor(rates.body, 'suite', adults).price
      const { orm } = makeOrm({ rooms: SUITE, rates: RATES, assignments: ASSIGNMENTS })
      const res = await createPublicBookingDirect(orm, bookingBody(adults))
      expect(res.status).toBe(201)
      // Antes acá salía 200 (basePrice × noches) para las CUATRO ocupaciones.
      expect(res.body.totalBreakdown.subtotal).toBe(published)
    }
  })

  it('la estadía que cruza temporadas se cobra noche a noche, no `precio fijo × noches`', async () => {
    const { orm } = makeOrm({ rooms: SUITE, rates: RATES, assignments: ASSIGNMENTS })
    const res = await createPublicBookingDirect(orm, bookingBody(2))
    // 90 + 120 = 210. Multiplicar cualquiera de las dos por 2 daría 180 o 240.
    expect(res.body.totalBreakdown.subtotal).toBe(210)
  })

  it('el override de canal (airbnb) no se filtra al precio que paga el huésped directo', async () => {
    const withOta = [...RATES, {
      hotelId: HOTEL_ID, roomType: 'suite', occupancy: 2, season: 'baja', channel: 'airbnb',
      price: 999, closed: 0,
    }]
    const { orm } = makeOrm({ rooms: SUITE, rates: withOta, assignments: ASSIGNMENTS })
    const res = await createPublicBookingDirect(orm, bookingBody(2))
    expect(res.body.totalBreakdown.subtotal).toBe(210)
  })
})

// ─── (4) el tipo sigue viajando mientras tenga alguna ocupación vendible ─────────────────────

describe('/rates — la ocupación agotada va en gris, no se lleva el tipo entero puesto', () => {
  const IN = '2026-09-10'
  const OUT = '2026-09-12'

  /** Familiar: UNA unidad de 4 (tomada) y una de 2 (libre). Es el caso del hallazgo. */
  const ROOMS = [
    { id: 'r-grande', hotelId: HOTEL_ID, type: 'familiar', capacity: 4, basePrice: 150, status: 'available' },
    { id: 'r-chica', hotelId: HOTEL_ID, type: 'familiar', capacity: 2, basePrice: 100, status: 'available' },
  ]
  const RESERVATIONS = [
    { id: 'res1', hotelId: HOTEL_ID, roomId: 'r-grande', status: 'confirmed', checkIn: IN, checkOut: OUT },
  ]

  /** `AvailabilityUseCase` REAL (no un mock): es el usecase que decide qué tipos viajan. */
  const availability = (rooms = ROOMS, reservations = RESERVATIONS, assignments: any[] = [], rates: any[] = []) =>
    new AvailabilityUseCase(
      noCache, repo(rooms), repo(reservations), { findOne: async () => HOTEL } as any,
      repo([]), repo(assignments), repo(rates),
    )

  it('buscando para 4 con la única unidad de 4 tomada, el tipo NO desaparece', async () => {
    const result = await availability().check({ hotelId: HOTEL_ID, checkIn: IN, checkOut: OUT, adults: 4 } as any)
    const rt = result.roomTypes.find((t) => t.roomType === 'familiar')
    expect(rt).toBeDefined()
    // Contrato intacto: `available` sigue siendo el conteo para el grupo consultado (0 aquí),
    // y la apertura por ocupación es la que muestra que 1 y 2 sí se pueden vender.
    expect(rt!.available).toBe(0)
    expect(rt!.availableByOccupancy).toEqual([1, 1, 0, 0])
  })

  it('/rates muestra la fila de 4 en gris y las de 1/2 vendibles en el mismo tipo', async () => {
    const res = await getPublicRates({
      hotels: { findOne: async () => HOTEL } as any,
      availability: { checkAvailability: (q: any) => availability().check(q) },
      config: { findMany: async () => [] } as any,
    } as any, SLUG, { checkIn: IN, checkOut: OUT, guests: 4 })

    expect(res.status).toBe(200)
    expect(res.body.roomTypes.map((t: any) => t.id)).toEqual(['familiar'])
    expect(rowFor(res.body, 'familiar', 1)).toMatchObject({ available: true })
    expect(rowFor(res.body, 'familiar', 2)).toMatchObject({ available: true })
    expect(rowFor(res.body, 'familiar', 3)).toMatchObject({ available: false, unavailableReason: 'no_availability' })
    expect(rowFor(res.body, 'familiar', 4)).toMatchObject({ available: false, unavailableReason: 'no_availability' })
    // `availableCount` es el que la landing y el widget ya consumen: no cambia de significado.
    expect(res.body.roomTypes[0].availableCount).toBe(0)
  })

  it('el stop-sell de UNA ocupación tampoco borra el tipo (para 4 cerrado, para 2 abierto)', async () => {
    const assignments = [
      { hotelId: HOTEL_ID, date: IN, season: 'alta' },
      { hotelId: HOTEL_ID, date: '2026-09-11', season: 'alta' },
    ]
    const rates = [
      { hotelId: HOTEL_ID, roomType: 'familiar', occupancy: 2, season: 'alta', channel: '', price: 100, closed: 0 },
      { hotelId: HOTEL_ID, roomType: 'familiar', occupancy: 4, season: 'alta', channel: '', price: 180, closed: 1 },
    ]
    const uc = availability([ROOMS[0]!], [], assignments, rates) // solo la unidad de 4, libre
    const res = await getPublicRates({
      hotels: { findOne: async () => HOTEL } as any,
      availability: { checkAvailability: (q: any) => uc.check(q) },
      config: { findMany: async () => [] } as any,
      seasonAssignments: repo(assignments),
      roomRates: repo(rates),
    } as any, SLUG, { checkIn: IN, checkOut: OUT, guests: 4 })

    expect(res.body.roomTypes.map((t: any) => t.id)).toEqual(['familiar'])
    expect(rowFor(res.body, 'familiar', 2)).toMatchObject({ available: true })
    expect(rowFor(res.body, 'familiar', 4)).toMatchObject({ available: false, unavailableReason: 'stop_sell' })
  })

  it('sin NINGUNA unidad libre el tipo sí se cae: no hay fila gris que justifique mostrarlo', async () => {
    const reservations = [
      { id: 'res1', hotelId: HOTEL_ID, roomId: 'r-grande', status: 'confirmed', checkIn: IN, checkOut: OUT },
      { id: 'res2', hotelId: HOTEL_ID, roomId: 'r-chica', status: 'confirmed', checkIn: IN, checkOut: OUT },
    ]
    const result = await availability(ROOMS, reservations).check(
      { hotelId: HOTEL_ID, checkIn: IN, checkOut: OUT, adults: 2 } as any,
    )
    expect(result.roomTypes).toEqual([])
  })

  it('un tipo donde el grupo NO ENTRA se sigue descartando (no es agotado: no existe)', async () => {
    const rooms = [{ id: 'r-chica', hotelId: HOTEL_ID, type: 'doble', capacity: 2, basePrice: 100, status: 'available' }]
    const result = await availability(rooms, []).check(
      { hotelId: HOTEL_ID, checkIn: IN, checkOut: OUT, adults: 4 } as any,
    )
    expect(result.roomTypes).toEqual([])
  })
})

// ─── (5) techo de ocupaciones también del lado del productor ─────────────────────────────────

describe('AvailabilityUseCase — `capacity` corrupto no genera miles de filas', () => {
  it('availableByOccupancy se corta en MAX_OCCUPANCY_ROWS', async () => {
    const rooms = [
      // 9999 es lo que deja un tipeo a mano en el panel; el motor no puede serializar 9999
      // posiciones por tipo en una ruta pública sin auth.
      { id: 'r1', hotelId: HOTEL_ID, type: 'dormi', capacity: 9999, basePrice: 20, status: 'available' },
    ]
    const uc = new AvailabilityUseCase(
      noCache, repo(rooms), repo([]), { findOne: async () => HOTEL } as any,
      repo([]), repo([]), repo([]),
    )
    const result = await uc.check({ hotelId: HOTEL_ID, checkIn: '2026-09-10', checkOut: '2026-09-11', adults: 2 } as any)
    const rt = result.roomTypes[0]!
    expect(rt.availableByOccupancy).toHaveLength(MAX_OCCUPANCY_ROWS)
    // `capacity` se sigue publicando tal cual (es el dato del hotel, no una decisión del motor).
    expect(rt.capacity).toBe(9999)
  })

  it('una capacidad normal no se toca', async () => {
    const rooms = [{ id: 'r1', hotelId: HOTEL_ID, type: 'suite', capacity: 4, basePrice: 100, status: 'available' }]
    const uc = new AvailabilityUseCase(
      noCache, repo(rooms), repo([]), { findOne: async () => HOTEL } as any,
      repo([]), repo([]), repo([]),
    )
    const result = await uc.check({ hotelId: HOTEL_ID, checkIn: '2026-09-10', checkOut: '2026-09-11', adults: 2 } as any)
    expect(result.roomTypes[0]!.availableByOccupancy).toEqual([1, 1, 1, 1])
  })
})
