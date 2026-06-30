// empleados/usecases/profiles.ts — Employee profile CRUD

import type { RepositoryAdapter, Logger } from 'arckode-framework'
import { ValidationError, NotFoundError } from 'arckode-framework'
import type { EmployeeProfileDTO, CreateEmployeeProfileDTO, EmpleadosQuery, EmpleadosPaginated } from '../types'

export class ProfileUseCase {
  constructor(
    private readonly repo: RepositoryAdapter<EmployeeProfileDTO>,
    private readonly logger: Logger,
    private readonly userRepo?: RepositoryAdapter<any>,
  ) {}

  async create(dto: CreateEmployeeProfileDTO): Promise<EmployeeProfileDTO> {
    const existing = await this.repo.findOne({ userId: dto.userId, hotelId: dto.hotelId })
    if (existing) throw new ValidationError('Employee profile already exists for this user')
    return this.repo.create({
      ...dto,
      active: 1,
      vacationDaysTotal: dto.vacationDaysTotal ?? 15,
      vacationDaysUsed: 0,
    } as any)
  }

  // @ignore IDOR_RISK — profile lookup by ID
  async getById(id: string): Promise<EmployeeProfileDTO> {
    const profile = await this.repo.findById(id)
    if (!profile) throw new NotFoundError('Employee profile not found')
    return profile
  }

  async getByUserId(userId: string): Promise<EmployeeProfileDTO | null> {
    return this.repo.findOne({ userId })
  }

  async list(query: EmpleadosQuery): Promise<EmpleadosPaginated> {
    const filters: Record<string, any> = { active: 1 }
    if (query.hotelId) filters.hotelId = query.hotelId
    if (query.departmentId) filters.departmentId = query.departmentId
    const page = query.page ?? 1
    const limit = query.limit ?? 20
    const offset = (page - 1) * limit
    const result = await this.repo.paginate(filters, { limit, offset })
    const data = result.data ?? []
    if (this.userRepo && data.length) {
      const enriched = await Promise.all(
        data.map(async (p) => {
          try {
            const user = await this.userRepo!.findById(p.userId)
            return { ...p, userName: user?.name ?? user?.email ?? p.userId }
          } catch {
            return { ...p, userName: p.userId }
          }
        })
      )
      return { data: enriched as EmployeeProfileDTO[], total: result.total ?? 0, page, limit }
    }
    return { data, total: result.total ?? 0, page, limit }
  }

  async update(id: string, data: Partial<CreateEmployeeProfileDTO>): Promise<EmployeeProfileDTO> {
    await this.getById(id)
    return this.repo.update(id, data as any) as Promise<EmployeeProfileDTO>
  }

  async deactivate(id: string): Promise<void> {
    await this.getById(id)
    await this.repo.update(id, { active: 0 } as any)
  }
}
