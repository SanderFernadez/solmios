// empleados/tests/eval-config.test.ts — Config del motor de evaluación (#322)
// Verifica: siembra del default, y validaciones (pesos suman 100, umbrales descendentes).

import { describe, it, expect } from 'bun:test'
import type { RepositoryAdapter } from 'arckode-framework'
import { silentLogger } from 'arckode-framework/testing'
import { EvalConfigUseCase } from '../usecases/eval-config'
import type { PerformanceEvalConfigDTO } from '../types'

const log = silentLogger()

function makeRepo(seed: PerformanceEvalConfigDTO | null): RepositoryAdapter<any> {
  let stored = seed
  return {
    findMany: async () => (stored ? [stored] : []),
    findById: async () => stored,
    findOne: async () => stored,
    create: async (data: any) => { stored = { id: 'cfg1', ...data }; return stored },
    update: async (id: string, data: any) => { stored = { ...(stored as any), ...data, id }; return stored },
    delete: async () => true,
    count: async () => 0,
    paginate: async () => ({ data: [], total: 0, limit: 20, offset: 0, pages: 0 }),
  }
}

const SEED: PerformanceEvalConfigDTO = {
  id: 'cfg1', hotelId: 'h1', period: 'monthly',
  weights: { productivity: 30, quality: 35, punctuality: 20, attendance: 15 },
  thresholds: { excellent: 90, good: 75, fair: 60 },
  standardTaskMinutes: 30, enabled: 1, createdAt: '', updatedAt: '',
}

describe('EvalConfigUseCase', () => {
  it('siembra el default la primera vez', async () => {
    const uc = new EvalConfigUseCase(makeRepo(null), log)
    const cfg = await uc.get('h1')
    expect(cfg.weights).toEqual({ productivity: 30, quality: 35, punctuality: 20, attendance: 15 })
    expect(cfg.thresholds).toEqual({ excellent: 90, good: 75, fair: 60 })
    expect(cfg.standardTaskMinutes).toBe(30)
  })

  it('rechaza pesos que no suman 100', async () => {
    const uc = new EvalConfigUseCase(makeRepo(SEED), log)
    await expect(uc.update('h1', { weights: { productivity: 50, quality: 35, punctuality: 20, attendance: 15 } }))
      .rejects.toThrow('deben sumar 100')
  })

  it('acepta pesos que suman 100', async () => {
    const uc = new EvalConfigUseCase(makeRepo(SEED), log)
    const cfg = await uc.update('h1', { weights: { productivity: 40, quality: 25, punctuality: 20, attendance: 15 } })
    expect(cfg.weights.productivity).toBe(40)
  })

  it('rechaza umbrales no descendentes', async () => {
    const uc = new EvalConfigUseCase(makeRepo(SEED), log)
    await expect(uc.update('h1', { thresholds: { excellent: 70, good: 75, fair: 60 } }))
      .rejects.toThrow('descendentes')
  })

  it('rechaza standardTaskMinutes <= 0', async () => {
    const uc = new EvalConfigUseCase(makeRepo(SEED), log)
    await expect(uc.update('h1', { standardTaskMinutes: 0 })).rejects.toThrow('mayor que 0')
  })
})
