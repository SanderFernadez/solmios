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
    // Por defecto solo activos. Con includeInactive se ven los desactivados (para reactivarlos) — así
    // "desactivar" no parece "borrar" (#174): el legajo sigue existiendo, solo hay que mostrarlo.
    const filters: Record<string, any> = {}
    if (!query.includeInactive) filters.active = 1
    if (query.hotelId) filters.hotelId = query.hotelId
    if (query.departmentId) filters.departmentId = query.departmentId
    const page = query.page ?? 1
    const limit = query.limit ?? 20
    const offset = (page - 1) * limit
    const result = await this.repo.paginate(filters, { limit, offset })
    const data = result.data ?? []
    if (this.userRepo && data.length) {
      // Traer los usuarios para poner el NOMBRE (no el userId). OJO: `findMany({ id: [array] })` NO
      // hace un WHERE IN — el ORM bindea el array como un solo valor, falla, y el nombre caía al userId
      // (por eso el listado mostraba el UUID). Se traen los usuarios del hotel en UN query; si no hay
      // hotelId acotado (super_admin global), se buscan por id en paralelo.
      const userIds = [...new Set(data.map(p => p.userId).filter(Boolean))]
      const usersMap = new Map<string, any>()
      try {
        if (query.hotelId) {
          for (const u of await this.userRepo.findMany({ hotelId: query.hotelId })) usersMap.set(u.id, u)
        }
        // Fallback por id para los userId que no estén en el set del hotel (ej: un super_admin con
        // hotelId 'platform', o un user movido de hotel). findMany({id:[array]}) NO sirve (sin WHERE IN).
        const missing = userIds.filter(id => !usersMap.has(id))
        if (missing.length) {
          const found = (await Promise.all(missing.map(id => this.userRepo!.findById(id).catch(() => null)))).filter(Boolean)
          for (const u of found as any[]) usersMap.set(u.id, u)
        }
      } catch { /* si falla, el front cae al cargo/userId */ }
      const enriched = data.map(p => {
        const u = usersMap.get(p.userId)
        // Si el user no existe (legajo huérfano), userName queda undefined → el front muestra el cargo,
        // no el UUID crudo. userRole permite mostrar el ROL en el listado (#172), no el puesto.
        return { ...p, userName: u?.name ?? u?.email ?? undefined, userRole: u?.role ?? undefined }
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

  /** Reactivar un legajo desactivado (#174: desactivar es reversible, no un borrado). */
  async reactivate(id: string, user?: SimpleUser): Promise<EmployeeProfileDTO> {
    await this.getById(id, user)
    return this.repo.update(id, { active: 1 } as any) as Promise<EmployeeProfileDTO>
  }
}
