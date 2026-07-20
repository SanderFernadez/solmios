// pricing/tests/controller-hotelid.test.ts — El hotelId sale del TOKEN, no de la query (SEC-1.2).
//
// Cubre la brecha que los tests de service NO ven: `hotelOf(req)` decide a qué hotel apunta el
// request antes de llamar al service. Probamos que el hotelId que llega al service es el del
// TOKEN y que `?hotelId=<víctima>` se ignora para merchant (y se respeta solo para super_admin).
//
// V3/V4: el override silencioso permitía leer/modificar tarifas y borrar rate-blocks de otro
// hotel (sabotaje económico). deleteBlock (V4) recibe el hotel del token y lo pasa al service,
// que debe verificar block.hotelId === hotelId antes de borrar.

import { describe, it, expect } from 'bun:test'
import { PricingController } from '../controller'

const silentLog = { info() {}, warn() {}, error() {}, debug() {} } as any

/** Service espía: graba el hotelId con el que cada método fue invocado. */
function makeController() {
  const calls: Array<[string, ...unknown[]]> = []
  const service = {
    listRates: async (id: string) => { calls.push(['listRates', id]); return [] },
    listSeasons: async (id: string) => { calls.push(['listSeasons', id]); return [] },
    deleteBlock: async (blockId: string, hotelId: string, _actor: unknown) => {
      calls.push(['deleteBlock', blockId, hotelId]); return undefined
    },
  } as any
  const calendar = {} as any   // este test no ejerce los overrides de calendario (días mínimos / temporadas)
  return { controller: new PricingController(service, silentLog, calendar), calls }
}

const req = (user: any, query: any = {}, params: any = {}) => ({ user, query, params, body: {} }) as any

describe('PricingController — hotelOf: token-first (SEC-1.2)', () => {
  it('un merchant ignora ?hotelId ajeno y opera sobre su hotel del token', async () => {
    const { controller, calls } = makeController()
    await controller.listRates(req({ id: 'u1', role: 'hotel_admin', hotelId: 'h1' }, { hotelId: 'h2-victima' }))
    expect(calls[0]).toEqual(['listRates', 'h1']) // NO 'h2-victima'
  })

  it('un super_admin SÍ puede apuntar a otro hotel vía ?hotelId (cross-hotel legítimo)', async () => {
    const { controller, calls } = makeController()
    await controller.listSeasons(req({ id: 'admin', role: 'super_admin', hotelId: 'platform' }, { hotelId: 'h2' }))
    expect(calls[0]).toEqual(['listSeasons', 'h2'])
  })

  it('merchant sin query usa token.hotelId', async () => {
    const { controller, calls } = makeController()
    await controller.listRates(req({ id: 'u1', role: 'hotel_admin', hotelId: 'h1' }))
    expect(calls[0]).toEqual(['listRates', 'h1'])
  })

  // deleteBlock es V4: el hotel del query ajeno NO debe llegar al borrado de un block de otro hotel.
  it('deleteBlock: el service recibe el hotel del token, nunca el del query ajeno', async () => {
    const { controller, calls } = makeController()
    await controller.deleteBlock(req({ id: 'u1', role: 'hotel_admin', hotelId: 'h1' }, { hotelId: 'h2-victima' }, { id: 'block-9' }))
    const del = calls.find((c) => c[0] === 'deleteBlock') as string[]
    expect(del[1]).toBe('block-9') // el id del recurso a borrar
    expect(del[2]).toBe('h1')      // el hotel del TOKEN — el service validará block.hotelId === 'h1'
  })
})
