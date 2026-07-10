// empleados/usecases/profiles.ts — Employee profile CRUD

import type { RepositoryAdapter, Logger, Auth } from 'arckode-framework'
import { ValidationError, NotFoundError } from 'arckode-framework'
import type { EmployeeProfileDTO, CreateEmployeeProfileDTO, EmpleadosQuery, EmpleadosPaginated } from '../types'
import type { SimpleUser } from './ownership'

const SENSITIVE_FIELDS = ['salary', 'bankAccount', 'bankName', 'emergencyContactPhone'] as const
const PRIVILEGED_ROLES = ['hotel_admin', 'super_admin']

function stripSensitive(profile: any, userRole?: string): any {
  if (!userRole || PRIVILEGED_ROLES.includes(userRole)) return profile
  const stripped = { ...profile }
  for (const field of SENSITIVE_FIELDS) {
    delete stripped[field]
  }
  return stripped
}

export class ProfileUseCase {
  constructor(
    private readonly repo: RepositoryAdapter<EmployeeProfileDTO>,
    private readonly logger: Logger,
    private readonly userRepo?: RepositoryAdapter<any>,
    private readonly auth?: Auth,
  ) {}

  /**
   * El perfil del propio usuario. Autoservicio: la app del personal necesita su `profile.id` para
   * pedir sus tareas, y `users:view` le daría los contratos, salarios y licencias de todo el hotel.
   */
  async mine(userId: string, hotelId?: string): Promise<EmployeeProfileDTO | null> {
    if (!userId) return null
    const filters: Record<string, unknown> = { userId }
    if (hotelId) filters.hotelId = hotelId
    return (await this.repo.findOne(filters)) ?? null
  }

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

  async getById(id: string, user?: SimpleUser): Promise<EmployeeProfileDTO> {
    const profile = await this.repo.findById(id)
    if (!profile) throw new NotFoundError('Employee profile not found')
    if (this.auth && user) this.auth.assertOwnership(profile.hotelId, user.hotelId ?? '', user.role, 'super_admin')
    return stripSensitive(profile, user?.role)
  }

  async getByUserId(userId: string, hotelId?: string): Promise<EmployeeProfileDTO | null> {
    const filters: Record<string, unknown> = { userId }
    if (hotelId) filters.hotelId = hotelId
    return this.repo.findOne(filters)
  }

  async list(query: EmpleadosQuery, user?: SimpleUser): Promise<EmpleadosPaginated> {
    const filters: Record<string, any> = { active: 1 }
    if (query.hotelId) filters.hotelId = query.hotelId
    if (query.departmentId) filters.departmentId = query.departmentId
    const page = query.page ?? 1
    const limit = query.limit ?? 20
    const offset = (page - 1) * limit
    const result = await this.repo.paginate(filters, { limit, offset })
    const data = result.data ?? []
    if (this.userRepo && data.length) {
      // Batch-fetch users to avoid N+1 queries
      const userIds = data.map(p => p.userId).filter(Boolean)
      let usersMap = new Map<string, any>()
      if (userIds.length) {
        try {
          const users = await this.userRepo!.findMany({ id: userIds })
          for (const u of users) usersMap.set(u.id, u)
        } catch { /* fallback to per-profile lookup */ }
      }
      const enriched = data.map(p => {
        const u = usersMap.get(p.userId)
        return { ...p, userName: u?.name ?? u?.email ?? p.userId }
      })
      return { data: enriched.map(p => stripSensitive(p, user?.role)), total: result.total ?? 0, page, limit }
    }
    return { data: data.map(p => stripSensitive(p, user?.role)), total: result.total ?? 0, page, limit }
  }

  async update(id: string, data: Partial<CreateEmployeeProfileDTO>, user?: SimpleUser): Promise<EmployeeProfileDTO> {
    await this.getById(id, user)
    return this.repo.update(id, data as any) as Promise<EmployeeProfileDTO>
  }

  async deactivate(id: string, user?: SimpleUser): Promise<void> {
    await this.getById(id, user)
    await this.repo.update(id, { active: 0 } as any)
  }
}
