// empleados/tests/dashboard.test.ts — El resumen consolidado de RRHH agrega bien y filtra por hotel.

import { describe, it, expect } from 'bun:test'
import { silentLogger } from 'arckode-framework/testing'
import { DashboardUseCase } from '../usecases/dashboard'

const log = silentLogger()
const day = (offset: number) => new Date(Date.now() + offset * 86_400_000).toISOString().slice(0, 10)
const today = day(0)
const monthStart = today.slice(0, 8) + '01'

function repo<T>(rows: T[]) {
  return { findMany: async () => rows } as any
}

describe('DashboardUseCase', () => {
  it('agrega headcount, departamentos, contratos, documentos, ausencias y evaluaciones', async () => {
    const profiles = [
      { id: 'p1', active: 1, departmentId: 'd1', hireDate: '2024-01-01' },
      { id: 'p2', active: 1, departmentId: 'd1', hireDate: '2024-01-01' },
      { id: 'p3', active: 1, departmentId: '', hireDate: monthStart },   // alta este mes, sin depto
      { id: 'p4', active: 0, departmentId: 'd1', hireDate: '2024-01-01' }, // inactivo → no cuenta
    ]
    const contracts = [
      { id: 'c1', status: 'active', endDate: day(10) },   // por vencer (<=30d)
      { id: 'c2', status: 'active', endDate: day(200) },  // activo, no por vencer
      { id: 'c3', status: 'terminated', endDate: day(5) },// terminado → no cuenta
    ]
    const documents = [{ id: 'doc1', expiryDate: day(10) }, { id: 'doc2', expiryDate: day(90) }]
    const leaves = [
      { id: 'l1', status: 'pending', startDate: day(5) },
      { id: 'l2', status: 'approved', startDate: day(7) },   // futura aprobada
      { id: 'l3', status: 'approved', startDate: day(-7) },  // pasada → no cuenta como upcoming
    ]
    const reviews = [
      { id: 'r1', status: 'completed', score: 8 },
      { id: 'r2', status: 'completed', score: 6 },
      { id: 'r3', status: 'scheduled', score: null },        // pendiente
    ]
    const departments = [{ id: 'd1', name: 'Recepción' }]

    const uc = new DashboardUseCase(
      repo(profiles), repo(contracts), repo(documents), repo(leaves), repo(reviews), repo(departments), log,
    )
    const d = await uc.get('h1')

    expect(d.headcount).toBe(3)
    expect(d.newHiresThisMonth).toBe(1)
    expect(d.byDepartment.find((x) => x.departmentId === 'd1')?.count).toBe(2)
    expect(d.byDepartment.find((x) => x.name === 'Sin departamento')?.count).toBe(1)
    expect(d.contracts).toEqual({ active: 2, expiringSoon: 1 })
    expect(d.documentsExpiring).toBe(1)
    expect(d.leaves).toEqual({ pending: 1, upcomingApproved: 1 })
    expect(d.reviews.pending).toBe(1)
    expect(d.reviews.avgScore).toBe(7)
  })

  it('devuelve ceros cuando el hotel no tiene datos', async () => {
    const uc = new DashboardUseCase(repo([]), repo([]), repo([]), repo([]), repo([]), repo([]), log)
    const d = await uc.get('h1')
    expect(d.headcount).toBe(0)
    expect(d.reviews.avgScore).toBeNull()
    expect(d.byDepartment).toEqual([])
  })
})
