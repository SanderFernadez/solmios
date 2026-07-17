// facturas/tests/list-n1.test.ts — Regresión de N+1 (auditoría #274 / optimización #276).
// El listado de N facturas debe hacer un número ACOTADO de queries (O(hoteles)), no O(N).
import { describe, it, expect } from 'bun:test'
import type { RepositoryAdapter, CacheAdapter, Auth } from 'arckode-framework'
import { silentLogger } from 'arckode-framework/testing'
import { FacturasService } from '../service'
import type { FacturasDTO, CurrentUser } from '../types'

const log = silentLogger()
const silentCache: CacheAdapter = { get: async () => null, set: async () => {}, delete: async () => {}, flush: async () => {} }
const mockAuth = { assertOwnership: () => {} } as unknown as Auth
const user: CurrentUser = { id: 'u1', hotelId: 'h1', role: 'hotel_admin' }

const emptyRepo = (): RepositoryAdapter<any> => ({
  findMany: async () => [], findById: async () => null, findOne: async () => null,
  create: async (d: any) => ({ id: 'x', ...d }), update: async (id: string, d: any) => ({ id, ...d }),
  delete: async () => true, count: async () => 0,
  paginate: async () => ({ data: [], total: 0, limit: 20, offset: 0, pages: 0, hasNext: false, hasPrev: false }),
})

describe('FacturasService.list — sin N+1', () => {
  it('N facturas de 1 hotel: guest/reservation/room/item findById|findMany 1 vez c/u (no por fila)', async () => {
    const N = 30
    const invoices = Array.from({ length: N }, (_, i) => ({
      id: `i${i}`, hotelId: 'h1', amount: 118, taxes: 18, guestId: `g${i}`, reservationId: `res${i}`,
    })) as FacturasDTO[]

    let guestFindById = 0, resFindById = 0, roomFindById = 0
    let guestFindMany = 0, resFindMany = 0, roomFindMany = 0, itemFindMany = 0

    const repo = { ...emptyRepo(), paginate: async () => ({ data: invoices, total: N, limit: 20, offset: 0, pages: 2, hasNext: true, hasPrev: false }) } as RepositoryAdapter<FacturasDTO>
    const enrichDeps = {
      guest: { ...emptyRepo(), findById: async () => { guestFindById++; return null }, findMany: async () => { guestFindMany++; return [] } },
      reservation: { ...emptyRepo(), findById: async () => { resFindById++; return null }, findMany: async () => { resFindMany++; return [] } },
      room: { ...emptyRepo(), findById: async () => { roomFindById++; return null }, findMany: async () => { roomFindMany++; return [] } },
    }
    const itemRepo = { ...emptyRepo(), findMany: async () => { itemFindMany++; return [] } } as RepositoryAdapter<any>
    const userRepo = { ...emptyRepo(), findById: async () => ({ id: 'u1', hotelId: 'h1' }) } as RepositoryAdapter<any>

    const svc = new FacturasService(repo, emptyRepo(), enrichDeps, userRepo, log, silentCache, mockAuth, itemRepo)
    const result = await svc.list({}, user)

    expect(result.data).toHaveLength(N)
    // CERO findById por fila.
    expect(guestFindById).toBe(0)
    expect(resFindById).toBe(0)
    expect(roomFindById).toBe(0)
    // 1 hotel => exactamente 1 findMany por repo relacionado.
    expect(guestFindMany).toBe(1)
    expect(resFindMany).toBe(1)
    expect(roomFindMany).toBe(1)
    expect(itemFindMany).toBe(1)
  })
})
