import type { RepositoryAdapter, Logger, CacheAdapter, Auth } from 'arckode-framework'
import { NotFoundError, AuthError } from 'arckode-framework'
import type { RolesDTO, CreateRolesDTO, UpdateRolesDTO, RolesQuery, RolesPaginated } from './types'
import type { RolesSockets } from './sockets'
import { auditSafely, type AuditPort } from '../../shared/usecases/audit'

const CACHE_TTL = 300

export class RolesService {
  private sockets: RolesSockets = {}
  private auditPort: AuditPort | null = null

  // SC-05: el connector roles-auditlog inyecta el puerto. Los cambios de roles/permisos
  // son operaciones sensibles → dejan rastro en el audit log.
  setAuditDeps(auditPort: AuditPort): void {
    this.auditPort = auditPort
  }

  constructor(
    private readonly repo: RepositoryAdapter<RolesDTO>,
    private readonly logger: Logger,
    private readonly cache: CacheAdapter,
    private readonly userRepo: RepositoryAdapter<any>,
    private readonly auth: Auth,
  ) {}

  setSockets(s: Partial<RolesSockets>): void {
    const next = s as Record<string, any>
    const cur = this.sockets as Record<string, any>
    for (const key of Object.keys(next)) {
      const h = next[key]
      if (!h) continue
      const prev = cur[key]
      cur[key] = prev ? async (...a: any[]) => { await prev(...a); await h(...a) } : h
    }
  }

  async list(query: RolesQuery, currentUser: { id: string; role: string; hotelId?: string }): Promise<RolesPaginated> {
    const filters: Record<string, unknown> = {}

    // Resolve hotelId from DB if not provided in token
    let hotelId = currentUser.hotelId
    if (!hotelId && currentUser.role !== 'super_admin') {
      const user = await this.userRepo.findById(currentUser.id)
      hotelId = user?.hotelId
    }

    if (currentUser.role !== 'super_admin') {
      if (!hotelId) throw new AuthError('No hotel assigned')
      filters.hotelId = hotelId
    } else if (query.hotelId) {
      filters.hotelId = query.hotelId
    }

    const page = Math.max(query.page || 1, 1)
    const limit = Math.min(Math.max(query.limit || 20, 1), 100)
    const offset = (page - 1) * limit

    const cacheKey = `roles:list:${hotelId || 'all'}`
    const cached = await this.cache.get(cacheKey)
    if (cached) return cached as RolesPaginated

    const result = await this.repo.paginate(filters, { offset, limit })

    // Conteo real de usuarios por rol: la columna `users` de la tabla nunca se mantiene. Se cuenta
    // desde los usuarios del hotel (un solo query, se tallan por nombre de rol). Solo cuando hay hotelId
    // acotado — para el listado global de super_admin se deja el valor guardado.
    let data = result.data
    if (hotelId) {
      const users = await this.userRepo.findMany({ hotelId })
      const countByRole = new Map<string, number>()
      for (const u of users as Array<{ role?: string }>) {
        if (u.role) countByRole.set(u.role, (countByRole.get(u.role) ?? 0) + 1)
      }
      data = result.data.map((r) => ({ ...r, users: countByRole.get(r.name) ?? 0 }))
    }

    const response = { data, total: result.total, page, limit, pages: Math.ceil(result.total / limit) }
    await this.cache.set(cacheKey, response, CACHE_TTL)
    return response
  }

  async getById(id: string, currentUser: { id: string; role: string; hotelId?: string }): Promise<RolesDTO> {
    const item = await this.repo.findById(id)
    if (!item) throw new NotFoundError('Rol no encontrado')
    if (currentUser.role !== 'super_admin' && item.hotelId !== currentUser.hotelId) {
      throw new AuthError('No autorizado')
    }
    return item
  }

  async create(dto: CreateRolesDTO, currentUser: { id: string; role: string; hotelId?: string }): Promise<RolesDTO> {
    if (currentUser.role !== 'super_admin' && dto.hotelId !== currentUser.hotelId) {
      throw new AuthError('No autorizado para crear en otro hotel')
    }
    // Un merchant NO puede crear roles del sistema (system:1 los protege de borrado/edición). El id lo
    // genera el server: el modelo lo exige y el ORM no lo autogenera para esta tabla.
    const payload = {
      ...dto,
      id: crypto.randomUUID(),
      system: currentUser.role === 'super_admin' ? (dto.system ?? 0) : 0,
      permissions: dto.permissions ?? [],
      users: 0,
    }
    const item = await this.repo.create(payload as any)
    await this.sockets.onRolesCreated?.(item)
    await this.cache.delete(`roles:list:${dto.hotelId}`)
    await auditSafely(this.auditPort, this.logger, {
      hotelId: item.hotelId, userId: currentUser.id, action: 'role.create',
      entity: 'role', entityId: item.id, detail: `Rol "${(item as any).name ?? ''}" creado`,
    })
    return item
  }

  async update(id: string, dto: UpdateRolesDTO, currentUser: { id: string; role: string; hotelId?: string }): Promise<RolesDTO> {
    const existing = await this.repo.findById(id)
    if (!existing) throw new NotFoundError('Rol no encontrado')
    if (currentUser.role !== 'super_admin' && existing.hotelId !== currentUser.hotelId) {
      throw new AuthError('No autorizado')
    }
    // Protect system roles from deletion/name change, but allow permission customization
    if (existing.system === 1) {
      // Only allow updating permissions for system roles
      const allowedFields = ['permissions']
      const protectedFields = Object.keys(dto).filter(k => !allowedFields.includes(k))
      if (protectedFields.length > 0) {
        throw new AuthError('No se pueden modificar los campos del sistema. Solo se pueden editar los permisos.')
      }
    }
    const item = await this.repo.update(id, dto as any)
    if (!item) throw new NotFoundError('Rol no encontrado')
    await this.sockets.onRolesUpdated?.(item)
    await this.cache.delete(`roles:list:${existing.hotelId}`)
    await auditSafely(this.auditPort, this.logger, {
      hotelId: existing.hotelId, userId: currentUser.id, action: 'role.update',
      entity: 'role', entityId: id,
      detail: dto.permissions ? 'Permisos del rol modificados' : 'Rol actualizado',
    })
    return item
  }

  async delete(id: string, currentUser: { id: string; role: string; hotelId?: string }): Promise<void> {
    const existing = await this.repo.findById(id)
    if (!existing) throw new NotFoundError('Rol no encontrado')
    if (currentUser.role !== 'super_admin' && existing.hotelId !== currentUser.hotelId) {
      throw new AuthError('No autorizado')
    }
    // Protect system roles
    if (existing.system === 1) {
      throw new AuthError('No se pueden eliminar roles del sistema')
    }
    const deleted = await this.repo.delete(id)
    if (!deleted) throw new NotFoundError('Rol no encontrado')
    await this.sockets.onRolesDeleted?.(id)
    await this.cache.delete(`roles:list:${existing.hotelId}`)
    await auditSafely(this.auditPort, this.logger, {
      hotelId: existing.hotelId, userId: currentUser.id, action: 'role.delete',
      entity: 'role', entityId: id, detail: `Rol "${(existing as any).name ?? ''}" eliminado`,
    })
  }
}
