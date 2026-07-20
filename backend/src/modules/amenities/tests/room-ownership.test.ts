// Bug encontrado probando la app real de punta a punta: GET/PUT
// /api/amenities/room/:roomId devolvía 404 SIEMPRE, en cualquier hotel, para
// cualquier habitación. `assertRoomInHotel` llamaba a `(this.service as
// any).orm`, que AmenitiesService nunca tuvo — `.orm?.findMany?.()` resolvía
// a `undefined` en silencio, `|| []` lo tapaba, y el ownership check daba
// siempre `false`.
//
// A diferencia de controller-hotelid.test.ts (que mockea el service entero
// como espía), este test usa el AmenitiesService REAL con repos falsos: es
// el único que ejercita roomBelongsToHotel/hotelIdOfUser de verdad. El bug
// vivía justo en esa línea que el mock nunca tocaba.
import { describe, it, expect } from 'bun:test'
import { AmenitiesService } from '../service'
import { AmenitiesController } from '../controller'
import type { RepositoryAdapter } from 'arckode-framework'

const silentLog = { info() {}, warn() {}, error() {}, debug() {} } as any

function fakeRepo(rows: any[]): RepositoryAdapter<any> {
  return {
    findById: async (id: string) => rows.find((r) => r.id === id) ?? null,
    findMany: async (filter: any = {}) => rows.filter((r) =>
      Object.entries(filter).every(([k, v]) => r[k] === v)),
    create: async (row: any) => { rows.push(row); return row },
    update: async (id: string, patch: any) => {
      const row = rows.find((r) => r.id === id)
      if (row) Object.assign(row, patch)
      return row
    },
  } as unknown as RepositoryAdapter<any>
}

function setup(rooms: any[] = [], users: any[] = []) {
  const hotelAmenitiesRepo = fakeRepo([])
  const roomAmenitiesRepo = fakeRepo([{ id: 'ra1', roomId: 'room-h1', amenityKey: 'wifi', isActive: 1 }])
  const service = new AmenitiesService(hotelAmenitiesRepo, roomAmenitiesRepo, silentLog, fakeRepo(rooms), fakeRepo(users))
  return { controller: new AmenitiesController(service, silentLog), service }
}

const req = (user: any, params: any = {}, body?: any) => ({ user, query: {}, params, body }) as any

describe('AmenitiesController — amenities por habitación (bug: siempre 404)', () => {
  it('trae las amenities cuando la habitación es del hotel del token', async () => {
    const { controller } = setup([{ id: 'room-h1', hotelId: 'h1' }])
    const res = await controller.listRoom(req({ id: 'u1', role: 'hotel_admin', hotelId: 'h1' }, { roomId: 'room-h1' }))
    expect(res.status).toBe(200)
    expect((res.body as any).data).toEqual([{ id: 'ra1', roomId: 'room-h1', amenityKey: 'wifi', isActive: 1 }])
  })

  it('devuelve 404 si la habitación es de OTRO hotel (IDOR)', async () => {
    const { controller } = setup([{ id: 'room-ajena', hotelId: 'h2-victima' }])
    const res = await controller.listRoom(req({ id: 'u1', role: 'hotel_admin', hotelId: 'h1' }, { roomId: 'room-ajena' }))
    expect(res.status).toBe(404)
  })

  it('devuelve 404 si la habitación no existe, no 500', async () => {
    const { controller } = setup([])
    const res = await controller.listRoom(req({ id: 'u1', role: 'hotel_admin', hotelId: 'h1' }, { roomId: 'no-existe' }))
    expect(res.status).toBe(404)
  })

  it('updateRoom respeta el mismo ownership check', async () => {
    const { controller } = setup([{ id: 'room-h1', hotelId: 'h1' }])
    const ok = await controller.updateRoom(req({ id: 'u1', role: 'hotel_admin', hotelId: 'h1' }, { roomId: 'room-h1' }, { amenities: ['wifi', 'tv'] }))
    expect(ok.status).toBe(200)

    const ajena = await controller.updateRoom(req({ id: 'u1', role: 'hotel_admin', hotelId: 'h1' }, { roomId: 'room-otro-hotel' }, { amenities: ['wifi'] }))
    expect(ajena.status).toBe(404)
  })

  it('hotelOf resuelve por usersRepo con tokens legacy sin hotelId embebido', async () => {
    // req.user.hotelId viene undefined a propósito: simula un token emitido
    // antes de que el JWT llevara hotelId (ver infrastructure/auth/hotel-auth.ts).
    const { controller } = setup(
      [{ id: 'room-h1', hotelId: 'h1' }],
      [{ id: 'u1', hotelId: 'h1' }],
    )
    const res = await controller.listRoom(req({ id: 'u1', role: 'hotel_admin', hotelId: undefined }, { roomId: 'room-h1' }))
    expect(res.status).toBe(200)
  })
})
