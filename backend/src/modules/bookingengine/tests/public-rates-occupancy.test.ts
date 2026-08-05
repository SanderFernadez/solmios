// bookingengine/tests/public-rates-occupancy.test.ts
//
// `GET /api/public/hotels/:slug/rates` devuelve, por tipo de habitación, UNA FILA POR OCUPACIÓN
// (1 → capacidad) en vez de un único precio — el despliegue que muestra la competencia:
//
//   Habitación Familiar                       Sólo 1 Disponible
//    👤     para 1   Precio 1 noches USD $70
//    👥     para 2   Precio 1 noches USD $70
//    👥👥   para 4   Precio 1 noches USD $70
//
// La regla que ancla este archivo: **la ocupación que el hotel no puede vender NO se oculta**.
// Viaja con `available:false` y un `unavailableReason` estable, para que el frontend la pinte en
// gris. Si la filtráramos, el huésped no distinguiría "no hay para 4 en estas fechas" de "este
// hotel no tiene habitaciones para 4".
//
// Casos:
//  (1) tarifas para 1 y 2, capacidad 3 → la fila de 3 viaja con `no_rate`.
//  (2) ocupación > capacidad (tarifa cargada "para 6" en una habitación de 4) → `over_capacity`.
//  (3) stop-sell (`room_rates.closed`) en la fila de una ocupación → `stop_sell`.
//  (4) sin unidades libres para esa ocupación en esas fechas → `no_availability`.
//  (5) REGRESIÓN de compatibilidad: `fromPrice`/`availableCount`/`capacity`/`taxBreakdown` no
//      cambiaron de valor con la matriz agregada.
//  (6) hotel SIN grilla de tarifas (el caso de casi todos): todas las ocupaciones cotizan al
//      fallback `rooms.basePrice`, ninguna queda desactivada de más.
//  (7) `availableByOccupancy` real de `AvailabilityUseCase` (integración): la unidad grande
//      ocupada apaga las ocupaciones altas y deja vivas las bajas.
import { describe, it, expect } from 'bun:test'
import type { CacheAdapter } from 'arckode-framework'
import { getPublicRates } from '../usecases/public-rates'
import { AvailabilityUseCase } from '../usecases/availability'
import type { AvailabilityResult } from '../types'

const SLUG = 'caribe-paradise'
const HOTEL_ID = 'h1'
const CHECK_IN = '2026-09-10'
const CHECK_OUT = '2026-09-12' // 2 noches: 10 y 11.

const HOTEL = {
  id: HOTEL_ID, name: 'Caribe Paradise', slug: SLUG,
  onlineBookingStatus: 'active', currency: 'USD', taxRate: 0,
}

const repo = (rows: any[]) => ({
  findMany: async (_f?: any) => rows,
  findOne: async (_f?: any) => rows[0] ?? null,
}) as any

/** `availability.checkAvailability` mockeado: los tests controlan el resultado agregado. */
const makeAvailability = (roomTypes: any[]) => ({
  checkAvailability: async (): Promise<AvailabilityResult> => ({
    hotelId: HOTEL_ID, hotelName: 'Caribe Paradise',
    checkIn: CHECK_IN, checkOut: CHECK_OUT, nights: 2, roomTypes,
  }),
})

interface Deps {
  roomTypes: any[]
  assignments?: any[]
  rates?: any[]
}

const makeDeps = (d: Deps) => ({
  hotels: { findOne: async () => HOTEL } as any,
  availability: makeAvailability(d.roomTypes),
  config: { findMany: async () => [] } as any,
  seasonAssignments: repo(d.assignments ?? []),
  roomRates: repo(d.rates ?? []),
})

const call = (d: Deps, guests?: number) =>
  getPublicRates(makeDeps(d) as any, SLUG, { checkIn: CHECK_IN, checkOut: CHECK_OUT, guests })

/** Las dos noches de la estadía pertenecen a la temporada 'alta'. */
const ASSIGNMENTS = [
  { hotelId: HOTEL_ID, date: '2026-09-10', season: 'alta' },
  { hotelId: HOTEL_ID, date: '2026-09-11', season: 'alta' },
]

const rate = (o: Partial<any>) => ({
  hotelId: HOTEL_ID, season: 'alta', channel: '', closed: 0, ...o,
})

const rowFor = (body: any, type: string, occupancy: number) =>
  body.roomTypes.find((t: any) => t.id === type)!
    .occupancies.find((o: any) => o.occupancy === occupancy)

// ─── (1) sin tarifa cargada para la ocupación ────────────────────────────────────────────────

describe('/rates — matriz de ocupaciones: sin tarifa para esa ocupación', () => {
  it('tarifas para 1 y 2 con capacidad 3 → la fila de 3 viaja desactivada con no_rate', async () => {
    const res = await call({
      roomTypes: [{
        roomType: 'familiar', available: 2, price: 0, currency: 'USD',
        capacity: 3, surfaceArea: 30, amenities: [], availableByOccupancy: [2, 2, 2],
      }],
      assignments: ASSIGNMENTS,
      rates: [
        rate({ roomType: 'familiar', occupancy: 1, price: 70 }),
        rate({ roomType: 'familiar', occupancy: 2, price: 90 }),
      ],
    })

    expect(res.status).toBe(200)
    const occ = res.body.roomTypes[0].occupancies
    // La matriz llega COMPLETA: 1, 2 y 3. La de 3 no se oculta.
    expect(occ.map((o: any) => o.occupancy)).toEqual([1, 2, 3])

    expect(occ[0]).toMatchObject({ occupancy: 1, price: 140, pricePerNight: 70, available: true, unavailableReason: null })
    expect(occ[1]).toMatchObject({ occupancy: 2, price: 180, pricePerNight: 90, available: true, unavailableReason: null })
    expect(occ[2]).toMatchObject({ occupancy: 3, available: false, unavailableReason: 'no_rate' })
    // Sin tarifa que cubra 3, NO se muestra el precio de la fila de 2 disfrazado de precio para 3.
    expect(occ[2].price).toBe(0)
    expect(occ[2].pricePerNight).toBe(0)
  })

  it('una tarifa de ocupación MAYOR sí cubre a un grupo menor (mismo criterio que pickRate)', async () => {
    const res = await call({
      roomTypes: [{
        roomType: 'familiar', available: 1, price: 0, currency: 'USD',
        capacity: 4, surfaceArea: 0, amenities: [], availableByOccupancy: [1, 1, 1, 1],
      }],
      assignments: ASSIGNMENTS,
      rates: [rate({ roomType: 'familiar', occupancy: 4, price: 100 })],
    })
    // "para 4" es el mismo producto con menos gente adentro: 1, 2 y 3 cotizan y se venden.
    for (const n of [1, 2, 3, 4]) {
      expect(rowFor(res.body, 'familiar', n)).toMatchObject({ available: true, price: 200 })
    }
  })
})

// ─── (2) supera la capacidad ─────────────────────────────────────────────────────────────────

describe('/rates — matriz de ocupaciones: supera la capacidad', () => {
  it('tarifa cargada "para 6" en una habitación de 4 → la fila de 6 viaja con over_capacity', async () => {
    const res = await call({
      roomTypes: [{
        roomType: 'suite', available: 1, price: 0, currency: 'USD',
        capacity: 4, surfaceArea: 0, amenities: [], availableByOccupancy: [1, 1, 1, 1],
      }],
      assignments: ASSIGNMENTS,
      rates: [
        rate({ roomType: 'suite', occupancy: 2, price: 100 }),
        rate({ roomType: 'suite', occupancy: 4, price: 150 }),
        rate({ roomType: 'suite', occupancy: 6, price: 200 }),
      ],
    })
    const occ = res.body.roomTypes[0].occupancies
    expect(occ.map((o: any) => o.occupancy)).toEqual([1, 2, 3, 4, 5, 6])
    expect(rowFor(res.body, 'suite', 4)).toMatchObject({ available: true })
    // 5 y 6 no entran en la habitación: se ven, en gris, con el motivo físico.
    expect(rowFor(res.body, 'suite', 5)).toMatchObject({ available: false, unavailableReason: 'over_capacity' })
    expect(rowFor(res.body, 'suite', 6)).toMatchObject({ available: false, unavailableReason: 'over_capacity' })
  })

  it('el huésped que busca para más gente de la que entra ve su propia fila en gris', async () => {
    const res = await call({
      roomTypes: [{
        roomType: 'standard', available: 3, price: 80, currency: 'USD',
        capacity: 2, surfaceArea: 0, amenities: [], availableByOccupancy: [3, 3],
      }],
    }, 5)
    const occ = res.body.roomTypes[0].occupancies
    expect(occ.map((o: any) => o.occupancy)).toEqual([1, 2, 3, 4, 5])
    expect(rowFor(res.body, 'standard', 5)).toMatchObject({ available: false, unavailableReason: 'over_capacity' })
  })
})

// ─── (3) stop-sell ───────────────────────────────────────────────────────────────────────────

describe('/rates — matriz de ocupaciones: stop-sell', () => {
  it('room_rates.closed en la fila de una ocupación → stop_sell solo en esa fila', async () => {
    const res = await call({
      roomTypes: [{
        roomType: 'doble', available: 2, price: 0, currency: 'USD',
        capacity: 3, surfaceArea: 0, amenities: [], availableByOccupancy: [2, 2, 2],
      }],
      assignments: ASSIGNMENTS,
      rates: [
        rate({ roomType: 'doble', occupancy: 1, price: 60 }),
        rate({ roomType: 'doble', occupancy: 2, price: 80 }),
        rate({ roomType: 'doble', occupancy: 3, price: 95, closed: 1 }),
      ],
    })
    expect(rowFor(res.body, 'doble', 1)).toMatchObject({ available: true })
    expect(rowFor(res.body, 'doble', 2)).toMatchObject({ available: true })
    expect(rowFor(res.body, 'doble', 3)).toMatchObject({ available: false, unavailableReason: 'stop_sell' })
    // El precio sigue viajando: hay tarifa, solo está cerrada. El widget la muestra tachada/gris.
    expect(rowFor(res.body, 'doble', 3).price).toBe(190)
  })

  it('un stop-sell del override de una OTA NO cierra el canal directo', async () => {
    const res = await call({
      roomTypes: [{
        roomType: 'doble', available: 2, price: 0, currency: 'USD',
        capacity: 2, surfaceArea: 0, amenities: [], availableByOccupancy: [2, 2],
      }],
      assignments: ASSIGNMENTS,
      rates: [
        rate({ roomType: 'doble', occupancy: 2, price: 80 }),
        rate({ roomType: 'doble', occupancy: 2, price: 99, closed: 1, channel: 'airbnb' }),
      ],
    })
    expect(rowFor(res.body, 'doble', 2)).toMatchObject({ available: true, price: 160 })
  })
})

// ─── (4) sin disponibilidad para esas fechas ─────────────────────────────────────────────────

describe('/rates — matriz de ocupaciones: sin disponibilidad', () => {
  it('sin unidades libres que acepten esa ocupación → no_availability (con precio a la vista)', async () => {
    const res = await call({
      roomTypes: [{
        roomType: 'familiar', available: 1, price: 0, currency: 'USD',
        capacity: 4, surfaceArea: 0, amenities: [],
        // Solo queda libre una unidad chica: entran hasta 2. Las de 3 y 4 están tomadas.
        availableByOccupancy: [1, 1, 0, 0],
      }],
      assignments: ASSIGNMENTS,
      rates: [
        rate({ roomType: 'familiar', occupancy: 2, price: 100 }),
        rate({ roomType: 'familiar', occupancy: 4, price: 160 }),
      ],
    })
    expect(rowFor(res.body, 'familiar', 2)).toMatchObject({ available: true, price: 200 })
    expect(rowFor(res.body, 'familiar', 3)).toMatchObject({ available: false, unavailableReason: 'no_availability' })
    expect(rowFor(res.body, 'familiar', 4)).toMatchObject({ available: false, unavailableReason: 'no_availability' })
    // Hay tarifa: el precio se muestra igual, en gris, para que el huésped sepa cuánto costaría.
    expect(rowFor(res.body, 'familiar', 4).price).toBe(320)
  })
})

// ─── (5) regresión de compatibilidad ─────────────────────────────────────────────────────────

describe('/rates — la matriz es ADITIVA (widget y landing en producción)', () => {
  it('fromPrice / availableCount / capacity / taxBreakdown no cambiaron de valor', async () => {
    const deps = {
      hotels: { findOne: async () => ({ ...HOTEL, taxRate: 18, taxName: 'ITBIS' }) } as any,
      availability: makeAvailability([{
        roomType: 'standard', available: 5, price: 100, currency: 'USD',
        capacity: 2, surfaceArea: 28, amenities: [], availableByOccupancy: [5, 5],
      }]),
      config: {
        findMany: async (f: any) => f?.key === 'taxes'
          ? [{ value: [{ activo: true, tasa: 18, nombre: 'ITBIS' }] }]
          : [],
      } as any,
    }
    const res = await getPublicRates(deps as any, SLUG, { checkIn: CHECK_IN, checkOut: CHECK_OUT })
    const rt = res.body.roomTypes[0]

    // Exactamente los mismos números que el test histórico `public-rates.test.ts` (happy path).
    expect(rt.id).toBe('standard')
    expect(rt.name).toBe('standard')
    expect(rt.fromPrice).toBe(200)
    expect(rt.availableCount).toBe(5)
    expect(rt.capacity).toBe(2)
    expect(rt.surfaceArea).toBe(28)
    expect(rt.taxBreakdown).toEqual([{ name: 'ITBIS', rate: 18, amount: 36 }])
    expect(res.body.nights).toBe(2)
    expect(res.body.currency).toBe('USD')
    expect(res.body.chargeCurrency).toBe('USD')

    // Y la matriz se AGREGA, coherente con `fromPrice` en la ocupación consultada (2 por default).
    expect(rt.occupancies).toHaveLength(2)
    expect(rowFor(res.body, 'standard', 2)).toEqual({
      occupancy: 2, price: 200, pricePerNight: 100, available: true, unavailableReason: null,
      taxBreakdown: [{ name: 'ITBIS', rate: 18, amount: 36 }],
    })
  })

  it('sin availableByOccupancy (caller viejo / caché previa) no se apaga nada de más', async () => {
    const res = await call({
      roomTypes: [{
        roomType: 'standard', available: 4, price: 100, currency: 'USD',
        capacity: 3, surfaceArea: 0, amenities: [],
      }],
    })
    const occ = res.body.roomTypes[0].occupancies
    expect(occ).toHaveLength(3)
    expect(occ.every((o: any) => o.available)).toBe(true)
  })
})

// ─── (6) hotel sin grilla de tarifas ─────────────────────────────────────────────────────────

describe('/rates — hotel sin room_rates cargadas (el caso de casi todos)', () => {
  it('todas las ocupaciones cotizan al fallback rooms.basePrice y ninguna queda en gris', async () => {
    const res = await call({
      roomTypes: [{
        roomType: 'standard', available: 2, price: 75, currency: 'USD',
        capacity: 3, surfaceArea: 0, amenities: [], availableByOccupancy: [2, 2, 2],
      }],
    })
    const occ = res.body.roomTypes[0].occupancies
    expect(occ.map((o: any) => o.occupancy)).toEqual([1, 2, 3])
    for (const row of occ) {
      expect(row.available).toBe(true)
      expect(row.unavailableReason).toBeNull()
      expect(row.price).toBe(150) // 75 × 2 noches
      expect(row.pricePerNight).toBe(75)
    }
  })

  it('sin tarifas y sin basePrice no hay nada que cotizar → no_rate', async () => {
    const res = await call({
      roomTypes: [{
        roomType: 'standard', available: 1, price: 0, currency: 'USD',
        capacity: 2, surfaceArea: 0, amenities: [], availableByOccupancy: [1, 1],
      }],
    })
    for (const row of res.body.roomTypes[0].occupancies) {
      expect(row).toMatchObject({ available: false, unavailableReason: 'no_rate', price: 0 })
    }
  })
})

// ─── (7) integración con AvailabilityUseCase real ────────────────────────────────────────────

describe('/rates — availableByOccupancy sale del motor real, no de un mock', () => {
  const noCache = { get: async () => null, set: async () => {} } as unknown as CacheAdapter

  it('la unidad grande ocupada apaga las ocupaciones altas y deja vivas las bajas', async () => {
    const rooms = [
      { id: 'r1', hotelId: HOTEL_ID, type: 'familiar', capacity: 4, basePrice: 120, status: 'available' },
      { id: 'r2', hotelId: HOTEL_ID, type: 'familiar', capacity: 2, basePrice: 100, status: 'available' },
    ]
    // r1 (la de 4) está reservada en el rango; r2 (la de 2) sigue libre.
    const reservations = [
      { id: 'res1', hotelId: HOTEL_ID, roomId: 'r1', status: 'confirmed', checkIn: CHECK_IN, checkOut: CHECK_OUT },
    ]
    const availability = new AvailabilityUseCase(
      noCache, repo(rooms), repo(reservations), { findOne: async () => HOTEL } as any,
      repo([]), repo([]), repo([]),
    )

    const result = await availability.check({ hotelId: HOTEL_ID, checkIn: CHECK_IN, checkOut: CHECK_OUT, adults: 2 } as any)
    const rt = result.roomTypes.find((t) => t.roomType === 'familiar')!
    // Compat: `available` sigue siendo el conteo para los huéspedes consultados.
    expect(rt.available).toBe(1)
    expect(rt.capacity).toBe(4)
    expect(rt.availableByOccupancy).toEqual([1, 1, 0, 0])

    const res = await getPublicRates(
      {
        hotels: { findOne: async () => HOTEL } as any,
        // `deps.availability` toma la firma del service (`checkAvailability`), que delega en
        // `AvailabilityUseCase.check`. Acá se hace el mismo puente, sin mock del resultado.
        availability: { checkAvailability: (q: any) => availability.check(q) },
        config: { findMany: async () => [] } as any,
      } as any,
      SLUG,
      { checkIn: CHECK_IN, checkOut: CHECK_OUT },
    )
    expect(rowFor(res.body, 'familiar', 2)).toMatchObject({ available: true })
    expect(rowFor(res.body, 'familiar', 3)).toMatchObject({ available: false, unavailableReason: 'no_availability' })
    expect(rowFor(res.body, 'familiar', 4)).toMatchObject({ available: false, unavailableReason: 'no_availability' })
  })
})
