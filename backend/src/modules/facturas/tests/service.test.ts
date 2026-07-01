// facturas/tests/service.test.ts — Tests del servicio
// Usa RepositoryAdapter mocks — sin dependencia de SQLite ni Postgres.

import { describe, it, expect } from 'bun:test'
import type { RepositoryAdapter, CacheAdapter, Auth } from 'arckode-framework'
import { silentLogger } from 'arckode-framework/testing'
import { FacturasService } from '../service'
import type { FacturasDTO, CurrentUser } from '../types'

const log = silentLogger()
const silentCache: CacheAdapter = { get: async () => null, set: async () => {}, delete: async () => {}, flush: async () => {} }

// Auth mock: replica la lógica real de assertOwnership (lanza si no es dueño ni admin).
const mockAuth = {
  assertOwnership: (rid: string, uid: string, role?: string, admin = 'admin') => {
    if (rid === uid) return
    if (role === admin) return
    throw new Error('Forbidden')
  },
} as unknown as Auth
const user: CurrentUser = { id: 'u1', hotelId: 'h1', role: 'hotel_admin' }

const emptyRepo = (): RepositoryAdapter<any> => ({
  findMany: async () => [], findById: async () => null, findOne: async () => null,
  create: async (d: any) => ({ id: 'test-id', ...d }), update: async (id: string, d: any) => ({ id, ...d }),
  delete: async () => true, count: async () => 0,
  paginate: async () => ({ data: [], total: 0, limit: 20, offset: 0, pages: 0, hasNext: false, hasPrev: false }),
})

function makeRepo(overrides: Partial<RepositoryAdapter<FacturasDTO>> = {}): RepositoryAdapter<FacturasDTO> {
  return { ...emptyRepo(), ...overrides } as RepositoryAdapter<FacturasDTO>
}

const enrichDeps = { guest: emptyRepo(), reservation: emptyRepo(), room: emptyRepo() }
// Users mock: el usuario u1 pertenece al hotel h1.
const userRepo = { ...emptyRepo(), findById: async () => ({ id: 'u1', hotelId: 'h1' }) } as RepositoryAdapter<any>

describe('FacturasService', () => {
  describe('getById', () => {
    it('lanza NotFound si el item no existe', async () => {
      const service = new FacturasService(makeRepo(), emptyRepo(), enrichDeps, userRepo, log, silentCache, mockAuth, emptyRepo())
      await expect(service.getById('no-existe', user)).rejects.toThrow('Factura no encontrada')
    })

    it('retorna el item enriquecido si existe y es del hotel del usuario', async () => {
      const item = { id: '1', hotelId: 'h1', amount: 100, taxes: 18 } as FacturasDTO
      const service = new FacturasService(makeRepo({ findById: async () => item }), emptyRepo(), enrichDeps, userRepo, log, silentCache, mockAuth, emptyRepo())
      const result = await service.getById('1', user)
      expect(result.id).toBe('1')
      expect(result.subtotal).toBe(82) // 100 - 18
    })

    it('rechaza acceso a factura de otro hotel (IDOR)', async () => {
      const item = { id: '1', hotelId: 'otro-hotel', amount: 100, taxes: 0 } as FacturasDTO
      const service = new FacturasService(makeRepo({ findById: async () => item }), emptyRepo(), enrichDeps, userRepo, log, silentCache, mockAuth, emptyRepo())
      await expect(service.getById('1', user)).rejects.toThrow()
    })
  })

  describe('list', () => {
    it('returns paginated invoices for super_admin', async () => {
      const invoices = [{ id: 'i1', hotelId: 'h1', amount: 100, taxes: 0 }] as FacturasDTO[]
      const repo = makeRepo({ paginate: async () => ({ data: invoices, total: 1, limit: 20, offset: 0, pages: 1, hasNext: false, hasPrev: false }) })
      const svc = new FacturasService(repo, emptyRepo(), enrichDeps, userRepo, log, silentCache, mockAuth, emptyRepo())
      const result = await svc.list({}, { id: 'admin', role: 'super_admin' })
      expect(result.data).toHaveLength(1)
    })

    it('filters by hotelId for hotel_admin', async () => {
      const invoices = [{ id: 'i1', hotelId: 'h1', amount: 100, taxes: 0 }] as FacturasDTO[]
      const repo = makeRepo({ paginate: async () => ({ data: invoices, total: 1, limit: 20, offset: 0, pages: 1, hasNext: false, hasPrev: false }) })
      const svc = new FacturasService(repo, emptyRepo(), enrichDeps, userRepo, log, silentCache, mockAuth, emptyRepo())
      const result = await svc.list({}, user)
      expect(result.data).toHaveLength(1)
    })
  })

  describe('create', () => {
    it('crea una factura calculando impuestos desde la config', async () => {
      const configRepo = { ...emptyRepo(), findOne: async () => ({ value: [{ tasa: 18, activo: true }] }) }
      const service = new FacturasService(makeRepo(), configRepo as any, enrichDeps, userRepo, log, silentCache, mockAuth, emptyRepo())
      const result = await service.create({ hotelId: 'h1', amount: 100, type: 'invoice' } as any, user)
      expect(result.id).toBe('test-id')
      expect(result.taxes).toBe(18)
      expect(result.amount).toBe(118)
      expect(result.invoiceNumber).toMatch(/^INV-\d{4}-/)
    })
  })

  describe('pay', () => {
    it('marca la factura como pagada', async () => {
      const inv = { id: 'i1', hotelId: 'h1', amount: 100, taxes: 0, status: 'pending' } as FacturasDTO
      const service = new FacturasService(makeRepo({ findById: async () => inv }), emptyRepo(), enrichDeps, userRepo, log, silentCache, mockAuth, emptyRepo())
      const result = await service.pay('i1', { method: 'card' }, user)
      expect(result.status).toBe('paid')
    })
  })

  describe('update', () => {
    it('updates own hotel invoice', async () => {
      const inv = { id: 'i1', hotelId: 'h1', amount: 100, taxes: 0 } as FacturasDTO
      const repo = makeRepo({ findById: async () => inv, update: async (id, data) => ({ id, ...data } as FacturasDTO) })
      const svc = new FacturasService(repo, emptyRepo(), enrichDeps, userRepo, log, silentCache, mockAuth, emptyRepo())
      const result = await svc.update('i1', { amount: 200 }, user)
      expect(result.amount).toBe(200)
    })

    it('rejects update to other hotel invoice', async () => {
      const inv = { id: 'i1', hotelId: 'otro-hotel', amount: 100, taxes: 0 } as FacturasDTO
      const repo = makeRepo({ findById: async () => inv })
      const svc = new FacturasService(repo, emptyRepo(), enrichDeps, userRepo, log, silentCache, mockAuth, emptyRepo())
      await expect(svc.update('i1', { amount: 200 }, user)).rejects.toThrow()
    })
  })

  describe('delete', () => {
    it('lanza NotFound si el item no existe', async () => {
      const service = new FacturasService(makeRepo({ delete: async () => false }), emptyRepo(), enrichDeps, userRepo, log, silentCache, mockAuth, emptyRepo())
      await expect(service.delete('no-existe', user)).rejects.toThrow('Factura no encontrada')
    })
  })
})
