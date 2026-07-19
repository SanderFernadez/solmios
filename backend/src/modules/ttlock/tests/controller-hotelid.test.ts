// ttlock/tests/controller-hotelid.test.ts — El hotelId sale del TOKEN, no de la query (SEC-1.1).
//
// Cubre la brecha que los tests de service NO ven: `hotelOf(req)` decide a qué hotel apunta el
// request ANTES de llamar al service. Si el controller mandara `query.hotelId` al service, el
// test de service (SEC-5.3) lo daría por bueno porque recibe un hotelId "válido". Acá probamos
// que el hotelId que llega al service es el del TOKEN y que `?hotelId=<víctima>` se ignora para
// merchant (y se respeta solo para super_admin).
//
// V1/V2: en ttlock este override silencioso permitía leer config ajena (secretos TTLock) y, peor,
// alimentar la generación de PIN con el hotel tainted → apertura de puerta de otro hotel.

import { describe, it, expect } from 'bun:test'
import { TtlockController } from '../controller'

const silentLog = { info() {}, warn() {}, error() {}, debug() {} } as any

/** Service espía: graba el hotelId con el que cada método fue invocado. */
function makeController() {
  const calls: Array<[string, ...unknown[]]> = []
  const service = {
    getConfig: async (id: string) => { calls.push(['getConfig', id]); return { configured: true } },
    listLocks: async (id: string) => { calls.push(['listLocks', id]); return [] },
    generateCode: async (id: string, reservationId: string) => {
      calls.push(['generateCode', id, reservationId]); return { code: 'x' }
    },
  } as any
  return { controller: new TtlockController(service, silentLog), calls }
}

const req = (user: any, query: any = {}, params: any = {}) => ({ user, query, params, body: {} }) as any

describe('TtlockController — hotelOf: token-first (SEC-1.1)', () => {
  it('un merchant ignora ?hotelId ajeno y opera sobre su hotel del token', async () => {
    const { controller, calls } = makeController()
    await controller.getConfig(req({ id: 'u1', role: 'hotel_admin', hotelId: 'h1' }, { hotelId: 'h2-victima' }))
    expect(calls[0]).toEqual(['getConfig', 'h1']) // NO 'h2-victima'
  })

  it('un super_admin SÍ puede apuntar a otro hotel vía ?hotelId (cross-hotel legítimo)', async () => {
    const { controller, calls } = makeController()
    await controller.getConfig(req({ id: 'admin', role: 'super_admin', hotelId: 'platform' }, { hotelId: 'h2' }))
    expect(calls[0]).toEqual(['getConfig', 'h2'])
  })

  it('merchant sin query usa token.hotelId', async () => {
    const { controller, calls } = makeController()
    await controller.listLocks(req({ id: 'u1', role: 'hotel_admin', hotelId: 'h1' }))
    expect(calls[0]).toEqual(['listLocks', 'h1'])
  })

  // generateCode es el punto de V2 (apertura física): el hotelId tainted NO debe llegar al code-gen.
  it('generateCode: el hotel del query ajeno nunca llega a la generación de PIN', async () => {
    const { controller, calls } = makeController()
    await controller.generateCode(req({ id: 'u1', role: 'hotel_admin', hotelId: 'h1' }, { hotelId: 'h2-victima' }, { reservationId: 'res1' }))
    const gen = calls.find((c) => c[0] === 'generateCode') as string[]
    expect(gen[1]).toBe('h1') // service recibe el hotel del token, nunca 'h2-victima'
    expect(gen[2]).toBe('res1')
  })
})
