// amenities/tests/controller-hotelid.test.ts — El hotelId sale del TOKEN, no de la query (SEC-1.3).
//
// Cubre la brecha que los tests de service NO ven: `hotelOf(req)` decide a qué hotel apunta el
// request antes de llamar al service. Probamos que el hotelId que llega al service es el del
// TOKEN y que `?hotelId=<víctima>` se ignora para merchant (y se respeta solo para super_admin).
//
// V5: el override silencioso permitía leer/escribir las amenities de otro hotel.

import { describe, it, expect } from 'bun:test'
import { AmenitiesController } from '../controller'

const silentLog = { info() {}, warn() {}, error() {}, debug() {} } as any

/** Service espía: graba el hotelId con el que cada método fue invocado. */
function makeController() {
  const calls: Array<[string, ...unknown[]]> = []
  const service = {
    listHotelAmenities: async (id: string) => { calls.push(['listHotelAmenities', id]); return [] },
    updateHotelAmenities: async (id: string, amenities: unknown) => {
      calls.push(['updateHotelAmenities', id, amenities]); return 1
    },
  } as any
  return { controller: new AmenitiesController(service, silentLog), calls }
}

const req = (user: any, query: any = {}, body: any = {}) => ({ user, query, params: {}, body }) as any

describe('AmenitiesController — hotelOf: token-first (SEC-1.3)', () => {
  it('un merchant ignora ?hotelId ajeno y opera sobre su hotel del token', async () => {
    const { controller, calls } = makeController()
    await controller.listHotel(req({ id: 'u1', role: 'hotel_admin', hotelId: 'h1' }, { hotelId: 'h2-victima' }))
    expect(calls[0]).toEqual(['listHotelAmenities', 'h1']) // NO 'h2-victima'
  })

  it('un super_admin SÍ puede apuntar a otro hotel vía ?hotelId (cross-hotel legítimo)', async () => {
    const { controller, calls } = makeController()
    await controller.listHotel(req({ id: 'admin', role: 'super_admin', hotelId: 'platform' }, { hotelId: 'h2' }))
    expect(calls[0]).toEqual(['listHotelAmenities', 'h2'])
  })

  it('merchant sin query usa token.hotelId', async () => {
    const { controller, calls } = makeController()
    await controller.listHotel(req({ id: 'u1', role: 'hotel_admin', hotelId: 'h1' }))
    expect(calls[0]).toEqual(['listHotelAmenities', 'h1'])
  })

  it('updateHotel: el service recibe el hotel del token, nunca el del query ajeno', async () => {
    const { controller, calls } = makeController()
    await controller.updateHotel(req({ id: 'u1', role: 'hotel_admin', hotelId: 'h1' }, { hotelId: 'h2-victima' }, { amenities: ['wifi'] }))
    const upd = calls.find((c) => c[0] === 'updateHotelAmenities') as string[]
    expect(upd[1]).toBe('h1')
  })
})
