// email-queue/tests/service.test.ts — list (aislamiento por hotel) + requeue (reset + ownership).
import { describe, it, expect } from 'bun:test'
import type { RepositoryAdapter, CacheAdapter, Auth } from 'arckode-framework'
import { silentLogger } from 'arckode-framework/testing'
import { EmailQueueService } from '../service'
import type { EmailQueueDTO } from '../types'

const log = silentLogger()
const silentCache: CacheAdapter = { get: async () => null, set: async () => {}, delete: async () => {}, flush: async () => {} }
const fakeAuth = { assertOwnership: () => {} } as unknown as Auth

const hotelAdmin = { id: 'user1', role: 'hotel_admin', hotelId: 'h1' }
const superAdmin = { id: 'admin1', role: 'super_admin', hotelId: undefined }

function makeRow(overrides: Partial<EmailQueueDTO> = {}): EmailQueueDTO {
  return {
    id: 'eq-1',
    hotelId: 'h1',
    recipient: 'guest@example.com',
    subject: 'Confirmación',
    html: '<p>hola</p>',
    status: 'failed',
    attempts: 3,
    maxAttempts: 3,
    lastError: 'SMTP timeout',
    nextRetryAt: null,
    createdAt: '2026-07-16T10:00:00Z',
    updatedAt: '2026-07-16T10:05:00Z',
    ...overrides,
  }
}

function makeRepo(overrides: Partial<RepositoryAdapter<EmailQueueDTO>> = {}): RepositoryAdapter<EmailQueueDTO> {
  return {
    findMany: async () => [],
    findById: async () => makeRow(),
    findOne: async () => null,
    create: async (data) => ({ id: 'eq-1', ...data } as EmailQueueDTO),
    update: async (id, data) => ({ ...makeRow(), id, ...data } as EmailQueueDTO),
    delete: async () => true,
    count: async () => 0,
    paginate: async () => ({ data: [makeRow()], total: 1, limit: 20, offset: 0, pages: 1 }),
    ...overrides,
  }
}

const userRepo = { findById: async () => ({ id: 'user1', hotelId: 'h1', role: 'hotel_admin' }) } as unknown as RepositoryAdapter<any>

describe('EmailQueueService', () => {
  describe('list', () => {
    it('filtra por hotelId del hotel_admin y por status', async () => {
      let seenFilters: Record<string, unknown> = {}
      const repo = makeRepo({
        paginate: async (filters) => { seenFilters = filters as Record<string, unknown>; return { data: [makeRow()], total: 1, limit: 20, offset: 0, pages: 1 } },
      })
      const svc = new EmailQueueService(repo, log, silentCache, userRepo, fakeAuth)
      const res = await svc.list({ status: 'failed' }, hotelAdmin)
      expect(res.total).toBe(1)
      expect(seenFilters.hotelId).toBe('h1')
      expect(seenFilters.status).toBe('failed')
    })

    it('super_admin no fuerza hotelId salvo query explícita', async () => {
      let seenFilters: Record<string, unknown> = {}
      const repo = makeRepo({
        paginate: async (filters) => { seenFilters = filters as Record<string, unknown>; return { data: [], total: 0, limit: 20, offset: 0, pages: 0 } },
      })
      const svc = new EmailQueueService(repo, log, silentCache, userRepo, fakeAuth)
      await svc.list({}, superAdmin)
      expect(seenFilters.hotelId).toBeUndefined()
    })
  })

  describe('requeue', () => {
    it('resetea status→pending y attempts→0', async () => {
      let updateArg: Partial<EmailQueueDTO> = {}
      const repo = makeRepo({
        update: async (id, data) => { updateArg = data as Partial<EmailQueueDTO>; return { ...makeRow(), id, ...data } as EmailQueueDTO },
      })
      const svc = new EmailQueueService(repo, log, silentCache, userRepo, fakeAuth)
      const res = await svc.requeue('eq-1', hotelAdmin)
      expect(res.status).toBe('pending')
      expect(updateArg.status).toBe('pending')
      expect(updateArg.attempts).toBe(0)
      expect(updateArg.lastError).toBeNull()
      expect(updateArg.nextRetryAt).toBeNull()
    })

    it('rechaza reencolar un email de otro hotel (ownership)', async () => {
      const repo = makeRepo({ findById: async () => makeRow({ hotelId: 'other-hotel' }) })
      const svc = new EmailQueueService(repo, log, silentCache, userRepo, fakeAuth)
      await expect(svc.requeue('eq-1', hotelAdmin)).rejects.toThrow()
    })

    it('404 si el email no existe en la cola', async () => {
      const repo = makeRepo({ findById: async () => null })
      const svc = new EmailQueueService(repo, log, silentCache, userRepo, fakeAuth)
      await expect(svc.requeue('nope', hotelAdmin)).rejects.toThrow()
    })
  })
})
