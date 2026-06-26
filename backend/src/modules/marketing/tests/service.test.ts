// marketing/tests/service.test.ts
import { describe, it, expect } from 'bun:test'
import type { RepositoryAdapter, CacheAdapter } from 'arckode-framework'
import { silentLogger } from 'arckode-framework/testing'
import { MarketingService } from '../service'

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

describe('MarketingService', () => {
  describe('createAutoMessage', () => {
    it('crea un auto-mensaje', async () => {
      const svc = new MarketingService(makeRepo(), makeRepo(), makeRepo(), log, silentCache)
      const msg = await svc.createAutoMessage({ hotelId: 'h1', title: 'Bienvenida', triggerEvent: 'checkin_day' })
      expect(msg.title).toBe('Bienvenida')
    })
  })

  describe('listAutoMessages', () => {
    it('retorna lista vacía', async () => {
      const svc = new MarketingService(makeRepo(), makeRepo(), makeRepo(), log, silentCache)
      const msgs = await svc.listAutoMessages('h1')
      expect(msgs).toEqual([])
    })
  })

  describe('createTemplate', () => {
    it('crea una plantilla WhatsApp', async () => {
      const svc = new MarketingService(makeRepo(), makeRepo(), makeRepo(), log, silentCache)
      const t = await svc.createTemplate({ hotelId: 'h1', name: 'Saludo', body: 'Hola {guest_name}' })
      expect(t.name).toBe('Saludo')
    })
  })

  describe('listMessageLogs', () => {
    it('retorna logs vacíos', async () => {
      const svc = new MarketingService(makeRepo(), makeRepo(), makeRepo(), log, silentCache)
      const logs = await svc.listMessageLogs('h1')
      expect(logs).toEqual([])
    })
  })
})
