//empleados/usecases/org-chart.ts — Org chart generation

import type { RepositoryAdapter, Logger } from 'arckode-framework'
import type { DepartmentDTO, EmployeeProfileDTO } from '../types'

export interface OrgChartNode {
  id: string
  name: string
  description: string
  managerId: string | null
  parentId: string | null
  employees: EmployeeProfileDTO[]
  children: OrgChartNode[]
}

export interface OrgChart {
  departments: OrgChartNode[]
  totalEmployees: number
}

export class OrgChartUseCase {
  constructor(
    private readonly departmentRepo: RepositoryAdapter<DepartmentDTO>,
    private readonly profileRepo: RepositoryAdapter<EmployeeProfileDTO>,
    private readonly logger: Logger,
    private readonly userRepo?: RepositoryAdapter<{ id: string; name?: string; email?: string }>,
  ) {}

  async getOrgChart(hotelId: string): Promise<OrgChart> {
    const departments = await this.departmentRepo.findMany({ hotelId, active: 1 })
    const profiles = await this.profileRepo.findMany({ hotelId, active: 1 })

    // Resolver el NOMBRE del empleado (no el userId) para que el organigrama sea legible.
    const userName = new Map<string, string>()
    if (this.userRepo) {
      try {
        for (const u of await this.userRepo.findMany({ hotelId })) userName.set(u.id, u.name || u.email || '')
      } catch { /* si falla, se cae al cargo en el front */ }
    }

    const deptMap = new Map<string, OrgChartNode>()
    for (const dept of departments) {
      deptMap.set(dept.id, { ...dept, employees: [], children: [] })
    }

    for (const profile of profiles) {
      const dept = deptMap.get(profile.departmentId ?? '')
      if (dept) {
        dept.employees.push({ ...profile, userName: userName.get(profile.userId) || undefined } as EmployeeProfileDTO)
      }
    }

    const roots: OrgChartNode[] = []
    for (const dept of departments) {
      const node = deptMap.get(dept.id)!
      if (dept.parentId && deptMap.has(dept.parentId)) {
        deptMap.get(dept.parentId)!.children.push(node)
      } else {
        roots.push(node)
      }
    }

    return { departments: roots, totalEmployees: profiles.length }
  }
}
