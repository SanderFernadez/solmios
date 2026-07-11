// empleados/usecases/dashboard.ts — Resumen consolidado de RRHH (talento).
//
// Agrega SOLO desde tablas que el módulo empleados posee (perfiles, contratos, documentos, ausencias,
// evaluaciones, departamentos): sin cross-module. Todo filtra por hotelId (multi-tenant). Datasets
// chicos → se traen y se agregan en memoria.

import type { RepositoryAdapter, Logger } from 'arckode-framework'
import type {
  EmployeeProfileDTO, ContractDTO, DocumentDTO,
  LeaveRequestDTO, PerformanceReviewDTO, DepartmentDTO,
} from '../types'

export interface HrDashboard {
  headcount: number
  byDepartment: { departmentId: string; name: string; count: number }[]
  contracts: { active: number; expiringSoon: number }
  documentsExpiring: number
  leaves: { pending: number; upcomingApproved: number }
  reviews: { pending: number; avgScore: number | null }
  newHiresThisMonth: number
}

const MS_PER_DAY = 86_400_000
const day = (d: Date): string => d.toISOString().slice(0, 10)
const truthy = (v: unknown): boolean => v === 1 || v === true || v === '1'

export class DashboardUseCase {
  constructor(
    private readonly profileRepo: RepositoryAdapter<EmployeeProfileDTO>,
    private readonly contractRepo: RepositoryAdapter<ContractDTO>,
    private readonly documentRepo: RepositoryAdapter<DocumentDTO>,
    private readonly leaveRepo: RepositoryAdapter<LeaveRequestDTO>,
    private readonly reviewRepo: RepositoryAdapter<PerformanceReviewDTO>,
    private readonly departmentRepo: RepositoryAdapter<DepartmentDTO>,
    private readonly logger: Logger,
  ) {}

  async get(hotelId: string): Promise<HrDashboard> {
    const now = new Date()
    const today = day(now)
    const in30 = day(new Date(now.getTime() + 30 * MS_PER_DAY))
    const monthStart = today.slice(0, 8) + '01'

    const [profiles, contracts, documents, leaves, reviews, departments] = await Promise.all([
      this.profileRepo.findMany({ hotelId }),
      this.contractRepo.findMany({ hotelId }),
      this.documentRepo.findMany({ hotelId }),
      this.leaveRepo.findMany({ hotelId }),
      this.reviewRepo.findMany({ hotelId }),
      this.departmentRepo.findMany({ hotelId }),
    ])

    const active = profiles.filter((p) => truthy((p as any).active))

    const deptName = new Map(departments.map((d) => [d.id, d.name]))
    const deptCount = new Map<string, number>()
    for (const p of active) {
      const key = (p as any).departmentId || ''
      deptCount.set(key, (deptCount.get(key) ?? 0) + 1)
    }
    const byDepartment = [...deptCount.entries()].map(([departmentId, count]) => ({
      departmentId,
      name: departmentId ? (deptName.get(departmentId) ?? 'Departamento') : 'Sin departamento',
      count,
    }))

    // Un contrato está "activo" si no fue terminado; "por vencer" si su endDate cae en los próximos 30 días.
    const activeContracts = contracts.filter((c) => (c as any).status !== 'terminated' && (c as any).status !== 'ended')
    const expiringContracts = activeContracts.filter((c) => {
      const end = String((c as any).endDate || '')
      return end >= today && end <= in30
    })

    const documentsExpiring = documents.filter((d) => {
      const exp = String((d as any).expiryDate || '')
      return exp >= today && exp <= in30
    }).length

    const pendingLeaves = leaves.filter((l) => (l as any).status === 'pending').length
    const upcomingApproved = leaves.filter((l) => (l as any).status === 'approved' && String((l as any).startDate || '') >= today).length

    const completedReviews = reviews.filter((r) => (r as any).status === 'completed' && typeof (r as any).score === 'number')
    const pendingReviews = reviews.filter((r) => (r as any).status !== 'completed').length
    const avgScore = completedReviews.length
      ? Math.round((completedReviews.reduce((s, r) => s + Number((r as any).score), 0) / completedReviews.length) * 10) / 10
      : null

    const newHiresThisMonth = active.filter((p) => String((p as any).hireDate || '') >= monthStart).length

    return {
      headcount: active.length,
      byDepartment,
      contracts: { active: activeContracts.length, expiringSoon: expiringContracts.length },
      documentsExpiring,
      leaves: { pending: pendingLeaves, upcomingApproved },
      reviews: { pending: pendingReviews, avgScore },
      newHiresThisMonth,
    }
  }
}
