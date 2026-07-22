// webhooks/tests/service.test.ts — CRUD + ownership + test() de subscriptions.

import { describe, it, expect } from 'bun:test'
import type { RepositoryAdapter, CacheAdapter } from 'arckode-framework'
import { silentLogger } from 'arckode-framework/testing'
import { WebhooksService } from '../service'
import type { WebhookSubscriptionDTO, WebhookDeliveryDTO } from '../types'

const log = silentLogger()
const silentCache: CacheAdapter = { get: async () => null, set: async () => {}, delete: async () => {}, flush: async () => {} }
/** Evita depender de DNS real: cualquier hostname "resuelve" a una IP pública fija. */
const publicLookup = async () => ['93.184.216.34']

const adminUser = { id: 'admin1', role: 'super_admin', hotelId: undefined }
const hotelAdmin = { id: 'user1', role: 'hotel_admin', hotelId: 'h1' }

function makeSubRepo(overrides: Partial<RepositoryAdapter<WebhookSubscriptionDTO>> = {}): RepositoryAdapter<WebhookSubscriptionDTO> {
  return {
    findMany: async () => [],
    findById: async () => null,
    findOne: async () => null,
    create: async (data) => ({ id: 'wh-1', ...data } as WebhookSubscriptionDTO),
    update: async (id, data) => ({ id, ...data } as WebhookSubscriptionDTO),
    delete: async () => true,
    count: async () => 0,
    paginate: async () => ({ data: [], total: 0, limit: 20, offset: 0, pages: 0 }),
    ...overrides,
  }
}

function makeDeliveryRepo(overrides: Partial<RepositoryAdapter<WebhookDeliveryDTO>> = {}): RepositoryAdapter<WebhookDeliveryDTO> {
  return {
    findMany: async () => [],
    findById: async () => null,
    findOne: async () => null,
    create: async (data) => ({ id: 'del-1', ...data } as WebhookDeliveryDTO),
    update: async (id, data) => ({ id, ...data } as WebhookDeliveryDTO),
    delete: async () => true,
    count: async () => 0,
    paginate: async () => ({ data: [], total: 0, limit: 20, offset: 0, pages: 0 }),
    ...overrides,
  }
}

describe('WebhooksService', () => {
  describe('create', () => {
    it('genera un secreto server-side y lo devuelve UNA vez', async () => {
      const svc = new WebhooksService(makeSubRepo(), makeDeliveryRepo(), log, silentCache, publicLookup)
      const result = await svc.create({ hotelId: 'h1', url: 'https://example.com/hook', events: ['reservation.created'] }, hotelAdmin) as any
      expect(result.secret).toMatch(/^whsec_/)
      expect(result.masked).toContain('whsec_')
    })

    it('rechaza crear sin al menos un evento', async () => {
      const svc = new WebhooksService(makeSubRepo(), makeDeliveryRepo(), log, silentCache)
      await expect(svc.create({ hotelId: 'h1', url: 'https://x.com', events: [] }, hotelAdmin)).rejects.toThrow()
    })

    it('rechaza crear en otro hotel si no es super_admin', async () => {
      const svc = new WebhooksService(makeSubRepo(), makeDeliveryRepo(), log, silentCache)
      await expect(svc.create({ hotelId: 'OTHER', url: 'https://x.com', events: ['ping'] }, hotelAdmin)).rejects.toThrow()
    })
  })

  describe('list', () => {
    it('enriquece cada subscription con delivered/failed y sin exponer el secreto', async () => {
      const subs = [{ id: 'wh-1', hotelId: 'h1', url: 'https://x.com', events: ['ping'], secret: 'whsec_abc', active: 1, createdAt: '', updatedAt: '' }] as WebhookSubscriptionDTO[]
      const subRepo = makeSubRepo({ paginate: async () => ({ data: subs, total: 1, limit: 20, offset: 0, pages: 1 }) })
      const delivRepo = makeDeliveryRepo({ count: async (filters) => ((filters as any)?.success === 1 ? 3 : 1) })
      const svc = new WebhooksService(subRepo, delivRepo, log, silentCache)
      const result = await svc.list({}, hotelAdmin)
      expect(result.data[0]).not.toHaveProperty('secret')
      expect(result.data[0].delivered).toBe(3)
      expect(result.data[0].failed).toBe(1)
    })
  })

  describe('getById / update / delete — ownership', () => {
    it('getById rechaza un webhook de otro hotel', async () => {
      const subRepo = makeSubRepo({ findById: async () => ({ id: 'wh-1', hotelId: 'OTHER', url: 'x', events: [], active: 1, createdAt: '', updatedAt: '' }) })
      const svc = new WebhooksService(subRepo, makeDeliveryRepo(), log, silentCache)
      await expect(svc.getById('wh-1', hotelAdmin)).rejects.toThrow()
    })

    it('super_admin puede leer cualquier hotel', async () => {
      const subRepo = makeSubRepo({ findById: async () => ({ id: 'wh-1', hotelId: 'OTHER', url: 'x', events: [], active: 1, createdAt: '', updatedAt: '' }) })
      const svc = new WebhooksService(subRepo, makeDeliveryRepo(), log, silentCache)
      const result = await svc.getById('wh-1', adminUser)
      expect(result.id).toBe('wh-1')
    })

    it('delete rechaza un webhook de otro hotel', async () => {
      const subRepo = makeSubRepo({ findById: async () => ({ id: 'wh-1', hotelId: 'OTHER', url: 'x', events: [], active: 1, createdAt: '', updatedAt: '' }) })
      const svc = new WebhooksService(subRepo, makeDeliveryRepo(), log, silentCache)
      await expect(svc.delete('wh-1', hotelAdmin)).rejects.toThrow()
    })
  })

  describe('test()', () => {
    it('dispara un ping y reporta delivered=true si la entrega quedó registrada como éxito', async () => {
      const sub = { id: 'wh-1', hotelId: 'h1', url: 'https://example.com', events: ['reservation.created'], secret: 'whsec_x', active: 1, createdAt: '', updatedAt: '' }
      const subRepo = makeSubRepo({ findById: async () => sub })
      let deliveredCount = 0
      const delivRepo = makeDeliveryRepo({
        count: async (filters) => ((filters as any)?.success === 1 ? deliveredCount : 0),
        create: async (data) => { if ((data as any).success === 1) deliveredCount++; return { id: 'del-1', ...data } as WebhookDeliveryDTO },
      })
      const originalFetch = globalThis.fetch
      globalThis.fetch = (async () => new Response(null, { status: 200 })) as any
      try {
        const svc = new WebhooksService(subRepo, delivRepo, log, silentCache, publicLookup)
        const result = await svc.test('wh-1', hotelAdmin)
        expect(result.delivered).toBe(true)
      } finally {
        globalThis.fetch = originalFetch
      }
    })
  })
})
