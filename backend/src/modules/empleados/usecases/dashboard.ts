// empleados/usecases/dashboard.ts — Resumen consolidado de RRHH (talento).
//
// Agrega SOLO desde tablas que el módulo empleados posee (perfiles, contratos, documentos, ausencias,
// evaluaciones, departamentos) + nombres de la tabla users (join de lectura): sin cross-module. Todo
// filtra por hotelId (multi-tenant). Datasets chicos → se traen y se agregan en memoria.
//
// El resumen de asistencia EN VIVO (presente/ausente hoy) NO vive acá: requiere el módulo attendance
// y se cablea por connector en su propia ola. Acá la "ocupación" se deriva de las ausencias aprobadas.

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
  // ── Widgets Odoo + pedidos del cliente ──
  birthdaysThisMonth: { employeeId: string; name: string; date: string; day: number }[]   // #196
  onLeaveToday: { employeeId: string; name: string; type: string; startDate: string; endDate: string }[] // #197
  topPerformers: { employeeId: string; name: string; avgScore: number; reviews: number }[] // #202
  occupancy: { total: number; available: number; onLeave: number; inactive: number }        // #200
  pending: { contractsExpiring: number; documentsExpiring: number; leavesPending: number; reviewsPending: number } // #205
  attendance: { present: number; absent: number; late: number } | null                       // #198 (vía connector)
}

/** Puerto que el connector `attendance-dashboard` cablea para traer el fichaje de hoy. */
export interface AttendanceSummaryPort {
  getTodaySummary(hotelId: string): Promise<{ present: number; late: number }>
}

const MS_PER_DAY = 86_400_000
const TOP_PERFORMERS = 5
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
    private readonly userRepo?: RepositoryAdapter<{ id: string; name?: string; email?: string }>,
  ) {}

  private attendancePort?: AttendanceSummaryPort
  /** El connector `attendance-dashboard` inyecta el fichaje de hoy. Sin él, `attendance` va null. */
  setAttendancePort(port: AttendanceSummaryPort): void { this.attendancePort = port }

  async get(hotelId: string): Promise<HrDashboard> {
    const now = new Date()
    const today = day(now)
    const in30 = day(new Date(now.getTime() + 30 * MS_PER_DAY))
    const monthStart = today.slice(0, 8) + '01'
    const currentMonth = today.slice(5, 7)

    const [profiles, contracts, documents, leaves, reviews, departments] = await Promise.all([
      this.profileRepo.findMany({ hotelId }),
      this.contractRepo.findMany({ hotelId }),
      this.documentRepo.findMany({ hotelId }),
      this.leaveRepo.findMany({ hotelId }),
      this.reviewRepo.findMany({ hotelId }),
      this.departmentRepo.findMany({ hotelId }),
    ])

    const active = profiles.filter((p) => truthy((p as any).active))

    // ── Nombres: el userId no sirve en la UI. Se traen los users del hotel en un query y se mapean.
    const nameByProfileId = new Map<string, string>()
    if (this.userRepo) {
      try {
        const users = await this.userRepo.findMany({ hotelId })
        const userName = new Map(users.map((u) => [u.id, u.name || u.email || '']))
        for (const p of profiles) {
          nameByProfileId.set((p as any).id, userName.get((p as any).userId) || (p as any).position || 'Empleado')
        }
      } catch { /* si falla, se cae al cargo/id abajo */ }
    }
    const nameOf = (profileId: string, fallback = 'Empleado'): string =>
      nameByProfileId.get(profileId) || fallback

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

    // ── #196 Cumpleaños del mes: perfiles activos cuyo mes de nacimiento es el corriente, ordenados por día.
    const birthdaysThisMonth = active
      .filter((p) => String((p as any).birthDate || '').slice(5, 7) === currentMonth)
      .map((p) => {
        const date = String((p as any).birthDate)
        return { employeeId: (p as any).id, name: nameOf((p as any).id, (p as any).position || 'Empleado'), date, day: Number(date.slice(8, 10)) }
      })
      .sort((a, b) => a.day - b.day)

    // ── #197 Colaboradores de ausencia HOY: licencias aprobadas que abarcan la fecha de hoy.
    const onLeaveToday = leaves
      .filter((l) => (l as any).status === 'approved'
        && String((l as any).startDate || '') <= today
        && String((l as any).endDate || '') >= today)
      .map((l) => ({
        employeeId: (l as any).employeeId,
        name: nameOf((l as any).employeeId),
        type: (l as any).type,
        startDate: (l as any).startDate,
        endDate: (l as any).endDate,
      }))

    // ── #202 Top desempeño: promedio por empleado sobre evaluaciones COMPLETADAS con score.
    const scoreAgg = new Map<string, { sum: number; count: number }>()
    for (const r of completedReviews) {
      const id = (r as any).employeeId
      const agg = scoreAgg.get(id) ?? { sum: 0, count: 0 }
      agg.sum += Number((r as any).score); agg.count += 1
      scoreAgg.set(id, agg)
    }
    const topPerformers = [...scoreAgg.entries()]
      .map(([employeeId, { sum, count }]) => ({
        employeeId,
        name: nameOf(employeeId),
        avgScore: Math.round((sum / count) * 10) / 10,
        reviews: count,
      }))
      .sort((a, b) => b.avgScore - a.avgScore || b.reviews - a.reviews)
      .slice(0, TOP_PERFORMERS)

    // ── #200 Ocupación del personal (3 estados): activos disponibles vs de licencia hoy vs inactivos.
    const onLeaveIds = new Set(onLeaveToday.map((l) => l.employeeId))
    const onLeaveCount = active.filter((p) => onLeaveIds.has((p as any).id)).length
    const occupancy = {
      total: profiles.length,
      available: active.length - onLeaveCount,
      onLeave: onLeaveCount,
      inactive: profiles.length - active.length,
    }

    // ── #198 Resumen de asistencia de HOY (vía connector attendance-dashboard). Ausentes = activos − presentes.
    let attendance: HrDashboard['attendance'] = null
    if (this.attendancePort) {
      try {
        const t = await this.attendancePort.getTodaySummary(hotelId)
        attendance = { present: t.present, absent: Math.max(0, active.length - t.present), late: t.late }
      } catch { attendance = null }
    }

    return {
      headcount: active.length,
      byDepartment,
      contracts: { active: activeContracts.length, expiringSoon: expiringContracts.length },
      documentsExpiring,
      leaves: { pending: pendingLeaves, upcomingApproved },
      reviews: { pending: pendingReviews, avgScore },
      newHiresThisMonth,
      birthdaysThisMonth,
      onLeaveToday,
      topPerformers,
      occupancy,
      pending: {
        contractsExpiring: expiringContracts.length,
        documentsExpiring,
        leavesPending: pendingLeaves,
        reviewsPending: pendingReviews,
      },
      attendance,
    }
  }
}
