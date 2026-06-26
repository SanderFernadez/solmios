// crm/tests/service.test.ts
import { describe, it, expect } from 'bun:test'
import type { RepositoryAdapter, CacheAdapter } from 'arckode-framework'
import { silentLogger } from 'arckode-framework/testing'
import { CrmService } from '../service'

const log = silentLogger()
const silentCache: CacheAdapter = { get: async () => null, set: async () => {}, delete: async () => {}, flush: async () => {} }

function makeRepo(overrides: Partial<RepositoryAdapter<any>> = {}): RepositoryAdapter<any> {
  return {
    findMany: async () => [], findById: async () => null, findOne: async () => null,
    create: async (data) => ({ id: 'test-id', ...data }),
    update: async (id, data) => ({ id, ...data }),
    delete: async () => true, count: async () => 0,
    paginate: async () => ({ data: [], total: 0, limit: 20, offset: 0, pages: 0 }),
    ...overrides,
  }
}

describe('CrmService', () => {
  describe('awardPoints', () => {
    it('otorga puntos a un huésped', async () => {
      const guestMock = makeRepo({
        findById: async () => ({ id: 'g1', name: 'Juan', loyaltyPoints: 50, totalStays: 3, totalSpent: 5000, tier: 'silver' }),
      })
      const svc = new CrmService(makeRepo(), makeRepo(), makeRepo(), guestMock, makeRepo(), log, silentCache)
      const txn = await svc.awardPoints('g1', 'h1', 100, 'Bienvenida')
      expect(txn.points).toBe(100)
      expect(txn.type).toBe('earn')
    })
  })

  describe('redeemPoints', () => {
    it('rechaza si puntos insuficientes', async () => {
      const guestMock = makeRepo({ findById: async () => ({ id: 'g1', loyaltyPoints: 10 }) })
      const svc = new CrmService(makeRepo(), makeRepo(), makeRepo(), guestMock, makeRepo(), log, silentCache)
      await expect(svc.redeemPoints('g1', 'h1', 100, 'Canje')).rejects.toThrow('Insufficient')
    })
  })

  describe('validateCoupon', () => {
    it('valida un cupón existente', async () => {
      const couponMock = makeRepo({
        findMany: async () => [{ id: 'c1', code: 'VERANO25', type: 'percentage', value: 25, minPurchase: 100, useCount: 0, maxUses: 50, active: 1 }],
      })
      const svc = new CrmService(makeRepo(), couponMock, makeRepo(), makeRepo(), makeRepo(), log, silentCache)
      const c = await svc.validateCoupon('VERANO25', 'h1', 200)
      expect(c.code).toBe('VERANO25')
    })
  })

  describe('getDashboard', () => {
    it('retorna dashboard', async () => {
      const guestMock = makeRepo({ findMany: async () => [] })
      const svc = new CrmService(makeRepo(), makeRepo(), makeRepo(), guestMock, makeRepo(), log, silentCache)
      const dash = await svc.getDashboard('h1')
      expect(dash.totalGuests).toBe(0)
    })
  })
})
