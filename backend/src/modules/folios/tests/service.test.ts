// folios/tests/service.test.ts — Tests del servicio de folios.
import { describe, it, expect } from 'bun:test'
import type { RepositoryAdapter, CacheAdapter, Auth } from 'arckode-framework'
import { silentLogger } from 'arckode-framework/testing'
import { FoliosService } from '../service'
import type { FolioDTO, FolioChargeDTO, CurrentUser } from '../types'

const log = silentLogger()
const silentCache: CacheAdapter = { get: async () => null, set: async () => {}, delete: async () => {}, flush: async () => {} }
const mockAuth = {
  assertOwnership: (rid: string, uid: string, role?: string, admin = 'admin') => {
    if (rid === uid) return; if (role === admin) return; throw new Error('Forbidden')
  },
} as unknown as Auth
const user: CurrentUser = { id: 'u1', hotelId: 'h1', role: 'hotel_admin' }

const emptyRepo = (): RepositoryAdapter<any> => ({
  findMany: async () => [], findById: async () => null, findOne: async () => null,
  create: async (d: any) => ({ id: 'x-' + Math.random().toString(36).slice(2, 7), ...d }),
  update: async (id: string, d: any) => ({ id, ...d }),
  delete: async () => true, count: async () => 0,
  paginate: async () => ({ data: [], total: 0, limit: 20, offset: 0, pages: 0 }),
})

describe('FoliosService', () => {
  function makeService(overrides: { folio?: Partial<RepositoryAdapter<FolioDTO>>; charge?: Partial<RepositoryAdapter<FolioChargeDTO>>; config?: any; deps?: any } = {}) {
    const charges: any[] = []
    const folioRepo: RepositoryAdapter<FolioDTO> = {
      ...emptyRepo(),
      findById: async (id: string) => ({ id, hotelId: 'h1', status: 'open', reservationId: null, guestId: null, roomId: null, currency: 'USD', invoiceId: null }) as FolioDTO,
      update: async (id: string, d: any) => ({ id, hotelId: 'h1', status: 'open', ...d } as FolioDTO),
      ...overrides.folio,
    }
    const chargeRepo: RepositoryAdapter<FolioChargeDTO> = {
      ...emptyRepo(),
      findMany: async (f?: any) => f && f.folioId ? charges.filter((c) => c.folioId === f.folioId) : charges,
      create: async (d: any) => { const c = { id: 'c-' + charges.length, ...d }; charges.push(c); return c as FolioChargeDTO },
      ...overrides.charge,
    }
    const configRepo = { ...emptyRepo(), findOne: async () => ({ value: [{ tasa: 18, activo: true }] }), ...overrides.config }
    const deps = {
      guest: { ...emptyRepo(), findById: async () => ({ name: 'Ana' }) },
      reservation: { ...emptyRepo(), findById: async () => ({ guestId: 'g1', roomId: 'r1' }) },
      room: { ...emptyRepo(), findById: async () => ({ number: '101' }) },
      user: { ...emptyRepo(), findById: async () => ({ id: 'u1', hotelId: 'h1' }) },
      ...overrides.deps,
    }
    const svc = new FoliosService(folioRepo, chargeRepo, configRepo, deps, log, silentCache, mockAuth)
    return { svc, charges }
  }

  it('abre un folio', async () => {
    const { svc } = makeService()
    const f = await svc.open({ hotelId: 'h1' }, user)
    expect(f.status).toBe('open')
    expect(f.hotelId).toBe('h1')
  })

  it('postea un cargo calculando impuesto (18%)', async () => {
    const { svc, charges } = makeService()
    const f = await svc.open({ hotelId: 'h1' }, user)
    const c = await svc.postCharge(f.id, { description: 'Minibar', amount: 100, category: 'minibar' }, user)
    expect(c.kind).toBe('charge')
    expect(c.taxes).toBe(18)
    expect(c.total).toBe(118)
    expect(charges.length).toBe(1)
  })

  it('aplica un pago que reduce el balance', async () => {
    const { svc } = makeService()
    const f = await svc.open({ hotelId: 'h1' }, user)
    await svc.postCharge(f.id, { description: 'Habitación', amount: 200, category: 'room' }, user)
    await svc.applyPayment(f.id, { amount: 100, method: 'Efectivo' }, user)
    const detail = await svc.getById(f.id, user)
    expect(detail.chargesTotal).toBe(236) // 200 + 18%
    expect(detail.paymentsTotal).toBe(100)
    expect(detail.balance).toBe(136)
  })

  it('cierra el folio', async () => {
    const { svc } = makeService()
    const f = await svc.open({ hotelId: 'h1' }, user)
    const closed = await svc.close(f.id, user)
    expect(closed.status).toBe('closed')
  })

  it('rechaza acceso a folio de otro hotel (IDOR)', async () => {
    const { svc } = makeService({ folio: { findById: async () => ({ id: '1', hotelId: 'otro', status: 'open' } as any) } })
    await expect(svc.getById('1', user)).rejects.toThrow()
  })
})
