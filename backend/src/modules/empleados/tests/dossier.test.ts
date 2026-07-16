// empleados/tests/dossier.test.ts — Expediente integral del empleado (#323)
// Verifica: consolida perfil + contratos + documentos + ausencias + reviews, y deriva el evalSummary
// de la evaluación automática (reviewerId='system') más reciente. Usa RepositoryAdapter mock.

import { describe, it, expect } from 'bun:test'
import type { RepositoryAdapter, CacheAdapter } from 'arckode-framework'
import { silentLogger } from 'arckode-framework/testing'
import { EmpleadosService } from '../service'
import { DossierUseCase } from '../usecases/dossier'
import type { EvalBreakdown } from '../types'

const log = silentLogger()
const silentCache: CacheAdapter = { get: async () => null, set: async () => {}, delete: async () => {}, flush: async () => {} }

function makeRepo(overrides: Partial<RepositoryAdapter<any>> = {}): RepositoryAdapter<any> {
  return {
    findMany: async () => [],
    findById: async () => null,
    findOne: async () => null,
    create: async (data) => ({ id: 'test-id', ...data }),
    update: async (id, data) => ({ id, ...data }),
    delete: async () => true,
    count: async () => 0,
    paginate: async () => ({ data: [], total: 0, limit: 20, offset: 0, pages: 0 }),
    ...overrides,
  }
}

const BREAKDOWN: EvalBreakdown = {
  productivity: { score: 50, weight: 30, hasData: true },
  quality: { score: 80, weight: 35, hasData: true },
  punctuality: { score: 90, weight: 20, hasData: true },
  attendance: { score: 90, weight: 15, hasData: true },
}

function buildService(reviews: any[]) {
  const profileRepo = makeRepo({ findById: async (id: string) => ({ id, userId: 'u1', hotelId: 'h1', position: 'Camarera', active: 1 }) })
  const contractRepo = makeRepo({ findMany: async () => [{ id: 'c1', hotelId: 'h1', employeeId: 'p1', status: 'active' }] })
  const documentRepo = makeRepo({ findMany: async () => [{ id: 'd1', hotelId: 'h1', employeeId: 'p1', name: 'Cédula' }] })
  const leaveRepo = makeRepo({ findMany: async () => [{ id: 'l1', hotelId: 'h1', employeeId: 'p1', status: 'approved' }] })
  const reviewRepo = makeRepo({ findMany: async () => reviews })
  // Sin auth → ownership se saltea (el flujo real lo cubre el guard + assertOwnership del profileRepo).
  return new EmpleadosService(makeRepo(), profileRepo, contractRepo, documentRepo, leaveRepo, reviewRepo, log, silentCache)
}

describe('DossierUseCase (#323)', () => {
  it('consolida perfil, contratos, documentos, ausencias y reviews', async () => {
    const service = buildService([{ id: 'r1', employeeId: 'p1', reviewerId: 'mgr1', period: '2026-Q2', reviewDate: '2026-04-01', score: 7 }])
    const dossier = await new DossierUseCase(service).get('p1')

    expect(dossier.profile.id).toBe('p1')
    expect(dossier.contracts).toHaveLength(1)
    expect(dossier.documents).toHaveLength(1)
    expect(dossier.leaveRequests).toHaveLength(1)
    expect(dossier.reviews).toHaveLength(1)
    // Sin reviews del sistema → no hay resumen automático.
    expect(dossier.evalSummary).toBeNull()
  })

  it('deriva el evalSummary de la evaluación automática más reciente', async () => {
    const service = buildService([
      { id: 'rm', employeeId: 'p1', reviewerId: 'mgr1', period: '2026-Q1', reviewDate: '2026-01-15', score: 6, answers: '' },
      { id: 'ra1', employeeId: 'p1', reviewerId: 'system', period: '2026-05', reviewDate: '2026-05-31', score: 71, answers: JSON.stringify({ band: 'fair', breakdown: BREAKDOWN }) },
      { id: 'ra2', employeeId: 'p1', reviewerId: 'system', period: '2026-06', reviewDate: '2026-06-30', score: 88, answers: JSON.stringify({ band: 'good', breakdown: BREAKDOWN }) },
    ])
    const dossier = await new DossierUseCase(service).get('p1')

    expect(dossier.reviews).toHaveLength(3)
    expect(dossier.evalSummary).not.toBeNull()
    expect(dossier.evalSummary!.latestScore).toBe(88) // la más reciente por reviewDate
    expect(dossier.evalSummary!.band).toBe('good')
    expect(dossier.evalSummary!.period).toBe('2026-06')
    expect(dossier.evalSummary!.totalAutomatic).toBe(2)
    expect(dossier.evalSummary!.breakdown).toEqual(BREAKDOWN)
  })

  it('tolera answers corrupto sin romper el expediente', async () => {
    const service = buildService([{ id: 'ra', employeeId: 'p1', reviewerId: 'system', period: '2026-06', reviewDate: '2026-06-30', score: 80, answers: '{not json' }])
    const dossier = await new DossierUseCase(service).get('p1')
    expect(dossier.evalSummary!.latestScore).toBe(80)
    expect(dossier.evalSummary!.band).toBeNull()
    expect(dossier.evalSummary!.breakdown).toBeNull()
  })
})
