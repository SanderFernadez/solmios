// El motor leía una tabla de stock que nadie llenaba (0 filas en toda la base):
// un hotel con 54 habitaciones libres respondía "no hay disponibilidad" a todos
// los clientes, con HTTP 200 y sin que nadie se enterara.
import { describe, it, expect } from 'bun:test'
import { AvailabilityUseCase } from '../usecases/availability'
import type { RepositoryAdapter, CacheAdapter } from 'arckode-framework'

const noCache = { get: async () => null, set: async () => {} } as unknown as CacheAdapter

const ROOMS = [
  { id: 'r1', hotelId: 'h1', type: 'double', capacity: 2, basePrice: 80, status: 'available' },
  { id: 'r2', hotelId: 'h1', type: 'double', capacity: 2, basePrice: 90, status: 'available' },
  { id: 'r3', hotelId: 'h1', type: 'suite', capacity: 4, basePrice: 150, status: 'available' },
  { id: 'r4', hotelId: 'h1', type: 'double', capacity: 2, basePrice: 80, status: 'out_of_order' },
]

function setup(reservations: any[] = [], rooms = ROOMS) {
  const repo = (rows: any[]): RepositoryAdapter<any> => ({
    findMany: async () => rows,
    findOne: async () => ({ id: 'h1', name: 'Hotel Prueba' }),
  } as unknown as RepositoryAdapter<any>)
  return new AvailabilityUseCase(noCache, repo(rooms), repo(reservations), repo([]))
}

const totalOf = (r: any) => r.roomTypes.reduce((s: number, t: any) => s + t.available, 0)

describe('Disponibilidad del motor de reservas', () => {
  it('ofrece las habitaciones reales del hotel', async () => {
    const r = await setup().check({ hotelId: 'h1', checkIn: '2026-08-10', checkOut: '2026-08-12', adults: 2 } as any)
    expect(r.hotelName).toBe('Hotel Prueba')  // viajaba vacío
    expect(r.nights).toBe(2)
    // r1 + r2 (double) + r3 (suite): una suite de 4 también sirve para 2.
    // r4 no cuenta: está fuera de servicio.
    expect(totalOf(r)).toBe(3)
  })

  it('no vende una habitación fuera de servicio', async () => {
    const r = await setup().check({ hotelId: 'h1', checkIn: '2026-08-10', checkOut: '2026-08-12', adults: 2 } as any)
    const double = r.roomTypes.find(t => t.roomType === 'double')!
    expect(double.available).toBe(2) // de 3 doubles, una está out_of_order
  })

  it('descuenta la habitación ya reservada en esas fechas', async () => {
    const r = await setup([
      { roomId: 'r1', status: 'confirmed', checkIn: '2026-08-09', checkOut: '2026-08-11' },
    ]).check({ hotelId: 'h1', checkIn: '2026-08-10', checkOut: '2026-08-12', adults: 2 } as any)
    expect(totalOf(r)).toBe(2) // de 3 vendibles, r1 quedó ocupada
  })

  it('una reserva CANCELADA libera la habitación', async () => {
    const r = await setup([
      { roomId: 'r1', status: 'cancelled', checkIn: '2026-08-09', checkOut: '2026-08-11' },
    ]).check({ hotelId: 'h1', checkIn: '2026-08-10', checkOut: '2026-08-12', adults: 2 } as any)
    expect(totalOf(r)).toBe(3)
  })

  it('el día de salida no bloquea: quien se va el 10 libera esa noche', async () => {
    const r = await setup([
      { roomId: 'r1', status: 'confirmed', checkIn: '2026-08-08', checkOut: '2026-08-10' },
    ]).check({ hotelId: 'h1', checkIn: '2026-08-10', checkOut: '2026-08-12', adults: 2 } as any)
    expect(totalOf(r)).toBe(3) // r1 se liberó ese mismo día
  })

  it('una reserva de otras fechas no afecta', async () => {
    const r = await setup([
      { roomId: 'r1', status: 'confirmed', checkIn: '2026-09-01', checkOut: '2026-09-05' },
    ]).check({ hotelId: 'h1', checkIn: '2026-08-10', checkOut: '2026-08-12', adults: 2 } as any)
    expect(totalOf(r)).toBe(3)
  })

  it('no ofrece habitaciones donde no entra el grupo', async () => {
    const r = await setup().check({ hotelId: 'h1', checkIn: '2026-08-10', checkOut: '2026-08-12', adults: 4 } as any)
    expect(r.roomTypes.map(t => t.roomType)).toEqual(['suite'])
  })

  it('publica el precio más barato de cada tipo', async () => {
    const r = await setup().check({ hotelId: 'h1', checkIn: '2026-08-10', checkOut: '2026-08-12', adults: 2 } as any)
    expect(r.roomTypes.find(t => t.roomType === 'double')!.price).toBe(80)
  })

  it('rechaza un rango inválido', async () => {
    await expect(
      setup().check({ hotelId: 'h1', checkIn: '2026-08-12', checkOut: '2026-08-10', adults: 2 } as any),
    ).rejects.toThrow('checkOut must be after checkIn')
  })
})
