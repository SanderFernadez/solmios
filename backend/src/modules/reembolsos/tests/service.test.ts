// reembolsos/tests/service.test.ts — Tests del servicio (RepositoryAdapter mock).

import { describe, it, expect } from 'bun:test'
import type { RepositoryAdapter, CacheAdapter } from 'arckode-framework'
import { silentLogger } from 'arckode-framework/testing'
import { ReembolsosService } from '../service'
import type { ExpenseClaimDTO } from '../types'

const log = silentLogger()
const silentCache: CacheAdapter = { get: async () => null, set: async () => {}, delete: async () => {}, flush: async () => {} }

function makeRepo(overrides: Partial<RepositoryAdapter<ExpenseClaimDTO>> = {}): RepositoryAdapter<ExpenseClaimDTO> {
  return {
    findMany: async () => [],
    findById: async () => null,
    findOne: async () => null,
    create: async (data) => ({ id: 'test-id', ...data } as ExpenseClaimDTO),
    update: async (id, data) => ({ id, ...data } as ExpenseClaimDTO),
    delete: async () => true,
    count: async () => 0,
    paginate: async () => ({ data: [], total: 0, limit: 20, offset: 0, pages: 0 }),
    ...overrides,
  }
}

describe('ReembolsosService', () => {
  it('create rechaza monto no positivo', async () => {
    const service = new ReembolsosService(makeRepo(), log, silentCache)
    await expect(service.create({ hotelId: 'h', employeeId: 'e', description: 'x', amount: 0, date: '2026-01-01' }))
      .rejects.toThrow('monto debe ser positivo')
  })

  it('create nace en borrador', async () => {
    const service = new ReembolsosService(makeRepo(), log, silentCache)
    const r = await service.create({ hotelId: 'h', employeeId: 'e', description: 'Taxi', amount: 500, date: '2026-01-01' })
    expect(r.status).toBe('draft')
  })

  it('approve exige que esté enviado', async () => {
    const item = { id: '1', hotelId: 'h', status: 'draft' } as ExpenseClaimDTO
    const service = new ReembolsosService(makeRepo({ findById: async () => item }), log, silentCache)
    await expect(service.approve('1', 'admin')).rejects.toThrow('enviado')
  })

  it('pay exige que esté aprobado', async () => {
    const item = { id: '1', hotelId: 'h', status: 'submitted' } as ExpenseClaimDTO
    const service = new ReembolsosService(makeRepo({ findById: async () => item }), log, silentCache)
    await expect(service.pay('1', 'cash')).rejects.toThrow('aprobado')
  })

  it('totals agrupa por estado', async () => {
    const claims = [
      { status: 'submitted', amount: 100 }, { status: 'approved', amount: 200 }, { status: 'paid', amount: 50 },
    ] as ExpenseClaimDTO[]
    const service = new ReembolsosService(makeRepo({ findMany: async () => claims }), log, silentCache)
    const t = await service.totals('h')
    expect(t.approved.amount).toBe(200)
    expect(t.submitted.count).toBe(1)
  })
})
