// folios/tests/list-n1.test.ts — Regresión de N+1 (auditoría #274 / optimización #276).
// El listado de N folios debe hacer un número ACOTADO de queries (O(hoteles)), no O(N).
import { describe, it, expect } from 'bun:test'
import type { RepositoryAdapter, CacheAdapter, Auth } from 'arckode-framework'
import { silentLogger } from 'arckode-framework/testing'
import { FoliosService } from '../service'
import type { FolioDTO, FolioChargeDTO, CurrentUser } from '../types'

const log = silentLogger()
const silentCache: CacheAdapter = { get: async () => null, set: async () => {}, delete: async () => {}, flush: async () => {} }
const mockAuth = { assertOwnership: () => {} } as unknown as Auth
const superAdmin: CurrentUser = { id: 'sa', role: 'super_admin' }

const emptyRepo = (): RepositoryAdapter<any> => ({
  findMany: async () => [], findById: async () => null, findOne: async () => null,
  create: async (d: any) => ({ id: 'x', ...d }), update: async (id: string, d: any) => ({ id, ...d }),
  delete: async () => true, count: async () => 0,
  paginate: async () => ({ data: [], total: 0, limit: 20, offset: 0, pages: 0 }),
})

describe('FoliosService.list — sin N+1', () => {
  it('50 folios de 1 hotel: charges+guests+rooms se cargan 1 vez c/u (no por fila)', async () => {
    const N = 50
    const folios: FolioDTO[] = Array.from({ length: N }, (_, i) => ({
      id: `f${i}`, hotelId: 'h1', status: 'open', reservationId: null,
      guestId: `g${i}`, roomId: `r${i}`, currency: 'USD', invoiceId: null,
    }) as FolioDTO)

    let chargeFindMany = 0, guestFindMany = 0, roomFindMany = 0
    let guestFindById = 0, roomFindById = 0

    const folioRepo: RepositoryAdapter<FolioDTO> = { ...emptyRepo(), findMany: async () => folios }
    const chargeRepo: RepositoryAdapter<FolioChargeDTO> = {
      ...emptyRepo(),
      findMany: async () => { chargeFindMany++; return [] },
    }
    const deps = {
      guest: { ...emptyRepo(), findMany: async () => { guestFindMany++; return [] }, findById: async () => { guestFindById++; return null } },
      reservation: emptyRepo(),
      room: { ...emptyRepo(), findMany: async () => { roomFindMany++; return [] }, findById: async () => { roomFindById++; return null } },
      user: emptyRepo(),
    }
    const svc = new FoliosService(folioRepo, chargeRepo, emptyRepo(), deps, log, silentCache, mockAuth)

    const result = await svc.list({}, superAdmin)
    expect(result.data).toHaveLength(N)
    // 1 hotel => exactamente 1 findMany por repo relacionado, y CERO findById por fila.
    expect(chargeFindMany).toBe(1)
    expect(guestFindMany).toBe(1)
    expect(roomFindMany).toBe(1)
    expect(guestFindById).toBe(0)
    expect(roomFindById).toBe(0)
  })
})
