// empleados/tests/auto-evaluation.test.ts — Motor de evaluación automática (#321)
// Verifica: score ponderado, renormalización cuando falta un criterio, skip sin data, e idempotencia por período.

import { describe, it, expect } from 'bun:test'
import type { RepositoryAdapter } from 'arckode-framework'
import { silentLogger } from 'arckode-framework/testing'
import { AutoEvaluationUseCase } from '../usecases/auto-evaluation'
import type { HkStaffStat, AttStaffStat, MaintStaffStat } from '../usecases/auto-evaluation'
import type { PerformanceEvalConfigDTO } from '../types'

const log = silentLogger()

const CONFIG: PerformanceEvalConfigDTO = {
  id: 'cfg1', hotelId: 'h1', period: 'monthly',
  weights: { productivity: 30, quality: 35, punctuality: 20, attendance: 15 },
  thresholds: { excellent: 90, good: 75, fair: 60 },
  standardTaskMinutes: 30, enabled: 1, createdAt: '', updatedAt: '',
}

// Config usecase de mentira: solo importa get(hotelId).
const fakeConfig = (cfg: PerformanceEvalConfigDTO = CONFIG) => ({ get: async () => cfg }) as any

function makeRepo(overrides: Partial<RepositoryAdapter<any>> = {}): RepositoryAdapter<any> {
  return {
    findMany: async () => [],
    findById: async () => null,
    findOne: async () => null,
    create: async (data: any) => ({ id: 'new-id', ...data }),
    update: async (id: string, data: any) => ({ id, ...data }),
    delete: async () => true,
    count: async () => 0,
    paginate: async () => ({ data: [], total: 0, limit: 20, offset: 0, pages: 0 }),
    ...overrides,
  }
}

const MIN = 60_000
function hkPort(stats: HkStaffStat[]) {
  return { getStaffStats: async () => stats }
}
function attPort(stats: AttStaffStat[]) {
  return { getStaffAttendance: async () => stats }
}
const HOUR = 3_600_000
function maintPort(stats: MaintStaffStat[]) {
  return { getStaffStats: async () => stats }
}

describe('AutoEvaluationUseCase', () => {
  it('computa el score ponderado sobre los 4 criterios con data', async () => {
    const profiles = [{ id: 'p1', userId: 'u1', active: 1 }]
    const uc = new AutoEvaluationUseCase(fakeConfig(), makeRepo(), makeRepo({ findMany: async () => profiles }), log)
    // productivity: avg 60min vs standard 30min → 30/60*100 = 50
    uc.setHousekeepingPort(hkPort([{ staffId: 'u1', completed: 5, avgDurationMs: 60 * MIN, avgRating: 8 }])) // quality: 8*10 = 80
    uc.setAttendancePort(attPort([{ employeeId: 'p1', present: 8, absent: 2, late: 2 }])) // punc 8/10=80, att 8/10=80

    const summary = await uc.run('h1')

    // weighted = 50*30 + 80*35 + 80*20 + 80*15 = 7100 ; /100 = 71
    expect(summary.evaluated).toBe(1)
    expect(summary.skipped).toBe(0)
    const r = summary.results[0]!
    expect(r.score).toBe(71)
    expect(r.band).toBe('fair') // 71 >= fair(60) pero < good(75)
    expect(r.breakdown.productivity).toEqual({ score: 50, weight: 30, hasData: true })
    expect(r.breakdown.quality).toEqual({ score: 80, weight: 35, hasData: true })
    expect(r.breakdown.punctuality.hasData).toBe(true)
    expect(r.breakdown.attendance.hasData).toBe(true)
  })

  it('puntúa a un técnico por mantenimiento (criterio maintenance, sin data de limpieza)', async () => {
    const profiles = [{ id: 'p2', userId: 'u2', active: 1 }]
    const uc = new AutoEvaluationUseCase(fakeConfig(), makeRepo(), makeRepo({ findMany: async () => profiles }), log)
    uc.setHousekeepingPort(hkPort([]))                       // el técnico no limpia → productivity/quality sin data
    uc.setAttendancePort(attPort([{ employeeId: 'p2', present: 9, absent: 1, late: 1 }])) // punc 90, att 90
    // maintenance: avg 48h vs standard 24h → 24/48*100 = 50 (weight default 30)
    uc.setMaintenancePort(maintPort([{ staffId: 'u2', resolved: 4, avgResolutionMs: 48 * HOUR }]))

    const r = (await uc.run('h1')).results[0]!

    expect(r.breakdown.maintenance).toEqual({ score: 50, weight: 30, hasData: true })
    expect(r.breakdown.productivity.hasData).toBe(false)     // no se inventa limpieza
    expect(r.breakdown.quality.hasData).toBe(false)
    // weighted = 90*20 + 90*15 + 50*30 = 4650 ; totalWeight = 65 → round(71.5) = 72
    expect(r.score).toBe(72)
  })

  it('un empleado sin data de mantenimiento no se ve afectado por el criterio maintenance', async () => {
    const profiles = [{ id: 'p1', userId: 'u1', active: 1 }]
    const uc = new AutoEvaluationUseCase(fakeConfig(), makeRepo(), makeRepo({ findMany: async () => profiles }), log)
    uc.setHousekeepingPort(hkPort([{ staffId: 'u1', completed: 5, avgDurationMs: 60 * MIN, avgRating: 8 }]))
    uc.setAttendancePort(attPort([{ employeeId: 'p1', present: 8, absent: 2, late: 2 }]))
    uc.setMaintenancePort(maintPort([]))                     // sin data de mant → criterio excluido por renormalización

    const r = (await uc.run('h1')).results[0]!
    expect(r.breakdown.maintenance?.hasData).toBe(false)
    expect(r.score).toBe(71)                                 // idéntico al test de 4 criterios (maintenance no altera)
  })

  it('renormaliza los pesos cuando un criterio no tiene data', async () => {
    const profiles = [{ id: 'p2', userId: 'u2', active: 1 }]
    const uc = new AutoEvaluationUseCase(fakeConfig(), makeRepo(), makeRepo({ findMany: async () => profiles }), log)
    // Sin housekeeping para u2 → productivity y quality quedan SIN data.
    uc.setHousekeepingPort(hkPort([]))
    uc.setAttendancePort(attPort([{ employeeId: 'p2', present: 9, absent: 1, late: 1 }])) // punc 9/10=90, att 9/10=90

    const r = (await uc.run('h1')).results[0]!

    // Solo punctuality(20) + attendance(15) tienen data → W=35. weighted = 90*20 + 90*15 = 3150 ; /35 = 90.
    // Renormalizado: NO se diluye a 90*35/100. Prueba la renormalización.
    expect(r.score).toBe(90)
    expect(r.band).toBe('excellent')
    expect(r.breakdown.productivity.hasData).toBe(false)
    expect(r.breakdown.quality.hasData).toBe(false)
  })

  it('saltea al empleado sin data en ningún criterio (no inventa score)', async () => {
    const profiles = [{ id: 'p3', userId: 'u3', active: 1 }]
    let created = 0
    const uc = new AutoEvaluationUseCase(
      fakeConfig(), makeRepo({ create: async (d: any) => { created++; return { id: 'x', ...d } } }),
      makeRepo({ findMany: async () => profiles }), log,
    )
    uc.setHousekeepingPort(hkPort([]))
    uc.setAttendancePort(attPort([]))

    const summary = await uc.run('h1')
    expect(summary.evaluated).toBe(0)
    expect(summary.skipped).toBe(1)
    expect(created).toBe(0) // sin data → no se crea review
  })

  it('es idempotente por período: actualiza la evaluación del sistema en vez de duplicar', async () => {
    const profiles = [{ id: 'p1', userId: 'u1', active: 1 }]
    let created = 0
    let updated = 0
    const reviewRepo = makeRepo({
      // Ya existe la automática del período → persist debe UPDATE, no CREATE.
      findOne: async (f: any) => (f.reviewerId === 'system' ? { id: 'existing-review' } : null),
      create: async (d: any) => { created++; return { id: 'new', ...d } },
      update: async (id: string, d: any) => { updated++; return { id, ...d } },
    })
    const uc = new AutoEvaluationUseCase(fakeConfig(), reviewRepo, makeRepo({ findMany: async () => profiles }), log)
    uc.setHousekeepingPort(hkPort([{ staffId: 'u1', completed: 3, avgDurationMs: 30 * MIN, avgRating: 9 }]))
    uc.setAttendancePort(attPort([{ employeeId: 'p1', present: 10, absent: 0, late: 0 }]))

    const summary = await uc.run('h1')
    expect(summary.evaluated).toBe(1)
    expect(summary.results[0]!.reviewId).toBe('existing-review')
    expect(created).toBe(0)
    expect(updated).toBe(1)
  })
})
