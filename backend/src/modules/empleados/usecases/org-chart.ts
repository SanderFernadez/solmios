//empleados/usecases/org-chart.ts — Org chart generation

import type { RepositoryAdapter, Logger } from 'arckode-framework'
import type { DepartmentDTO, EmployeeProfileDTO } from '../types'

export class OrgChartUseCase {
  constructor(
    private readonly departmentRepo: RepositoryAdapter<DepartmentDTO>,
    private readonly profileRepo: RepositoryAdapter<EmployeeProfileDTO>,
    private readonly logger: Logger,
  ) {}

  async getOrgChart(hotelId: string): Promise<any> {
    const departments = await this.departmentRepo.findMany({ hotelId, active: 1 })
    const profiles = await this.profileRepo.findMany({ hotelId, active: 1 })

    const deptMap = new Map<string, any>()
    for (const dept of departments) {
      deptMap.set(dept.id, { ...dept, employees: [], children: [] })
    }

    for (const profile of profiles) {
      const dept = deptMap.get(profile.departmentId ?? '')
      if (dept) {
        dept.employees.push(profile)
      }
    }

    const roots: any[] = []
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
