// auditlog/tests/service.test.ts — Tests del servicio (append-only: list/getById/create).

import { describe, it, expect } from 'bun:test'
import type { RepositoryAdapter, CacheAdapter, Auth } from 'arckode-framework'
import { silentLogger } from 'arckode-framework/testing'
import { AuditlogService } from '../service'
import type { AuditlogDTO } from '../types'

const log = silentLogger()
const silentCache: CacheAdapter = { get: async () => null, set: async () => {}, delete: async () => {}, clear: async () => {}, flush: async () => {} }
const mockAuth = {
  assertOwnership: (rid: string, uid: string, role?: string, admin = 'admin') => {
    if (rid === uid) return; if (role === admin) return; throw new Error('Forbidden')
  },
} as unknown as Auth
const user = { id: 'u1', hotelId: 'h1', role: 'hotel_admin' }

const emptyRepo = (): RepositoryAdapter<any> => ({
  findMany: async () => [], findById: async () => null, findOne: async () => null,
  create: async (d: any) => ({ id: 'test-id', ...d }), update: async (id: string, d: any) => ({ id, ...d }),
  delete: async () => true, count: async () => 0,
  paginate: async () => ({ data: [], total: 0, limit: 20, offset: 0, pages: 0 }),
})

function makeService(repoOver: Partial<RepositoryAdapter<AuditlogDTO>> = {}, userHotel = 'h1') {
  const repo = { ...emptyRepo(), ...repoOver } as RepositoryAdapter<AuditlogDTO>
  const userRepo = { ...emptyRepo(), findById: async () => ({ id: 'u1', hotelId: userHotel }) } as RepositoryAdapter<any>
  return new AuditlogService(repo, userRepo, log, silentCache, mockAuth)
}

describe('AuditlogService', () => {
  it('lanza NotFound si el item no existe', async () => {
    const service = makeService()
    await expect(service.getById('no-existe', user)).rejects.toThrow('Auditlog no encontrado')
  })

  it('retorna el item si existe y es del hotel del usuario', async () => {
    const item = { id: '1', hotelId: 'h1' } as AuditlogDTO
    const service = makeService({ findById: async () => item })
    const result = await service.getById('1', user)
    expect(result.id).toBe('1')
  })

  it('rechaza acceso a log de otro hotel (IDOR)', async () => {
    const item = { id: '1', hotelId: 'otro' } as AuditlogDTO
    const service = makeService({ findById: async () => item })
    await expect(service.getById('1', user)).rejects.toThrow()
  })

  it('crea y retorna el item', async () => {
    const service = makeService()
    const result = await service.create({ hotelId: 'h1' } as any)
    expect(result.id).toBe('test-id')
  })
})
