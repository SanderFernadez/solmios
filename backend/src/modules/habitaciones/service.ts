import type { RepositoryAdapter, Logger, CacheAdapter, Auth } from 'arckode-framework'
import { NotFoundError, AuthError } from 'arckode-framework'
import type { HabitacionesDTO, CreateHabitacionesDTO, UpdateHabitacionesDTO, HabitacionesQuery, HabitacionesPaginated } from './types'
import type { HabitacionesSockets } from './sockets'

export class HabitacionesService {
  private sockets: HabitacionesSockets = {}

  constructor(
    private readonly repo: RepositoryAdapter<HabitacionesDTO>,
    private readonly logger: Logger,
    private readonly cache: CacheAdapter,
    private readonly auth: Auth,
  ) {}

  setSockets(s: Partial<HabitacionesSockets>): void {
    const next = s as Record<string, any>
    const cur = this.sockets as Record<string, any>
    for (const key of Object.keys(next)) {
      const h = next[key]
      if (!h) continue
      const prev = cur[key]
      cur[key] = prev ? async (...a: any[]) => { await prev(...a); await h(...a) } : h
    }
  }

  async list(query: HabitacionesQuery, currentUser: { id: string; role: string; hotelId?: string }): Promise<HabitacionesPaginated> {
    const filters: Record<string, unknown> = {}
    if (query.status) filters.status = query.status
    if (query.type) filters.type = query.type

    // Multi-tenancy
    if (currentUser.role !== 'super_admin') {
      if (!currentUser.hotelId) throw new AuthError('No hotel assigned')
      filters.hotelId = currentUser.hotelId
    } else if (query.hotelId) {
      filters.hotelId = query.hotelId
    }

    const page = Math.max(query.page || 1, 1)
    const limit = Math.min(Math.max(query.limit || 20, 1), 100)
    const offset = (page - 1) * limit

    // Cache check
    const cacheKey = `habitaciones:list:${currentUser.hotelId || 'all'}:${JSON.stringify(query)}`
    const cached = await this.cache.get(cacheKey)
    if (cached) return cached as HabitacionesPaginated

    let result
    if (query.search) {
      // For search, add number filter and use paginate
      filters.number = { $like: `%${query.search}%` }
      result = await this.repo.paginate({ filters, offset, limit })
    } else {
      result = await this.repo.paginate({ filters, offset, limit })
    }

    const response = { data: result.data, total: result.total, page, limit, pages: Math.ceil(result.total / limit) }
    await this.cache.set(cacheKey, response, 300)
    return response
  }

  async getById(id: string, currentUser: { id: string; role: string; hotelId?: string }): Promise<HabitacionesDTO> {
    const item = await this.repo.findById(id)
    if (!item) throw new NotFoundError('Habitación no encontrada')
    if (currentUser.role !== 'super_admin' && item.hotelId !== currentUser.hotelId) {
      throw new AuthError('No autorizado')
    }
    return item
  }

  async create(dto: CreateHabitacionesDTO, currentUser: { id: string; role: string; hotelId?: string }): Promise<HabitacionesDTO> {
    if (currentUser.role !== 'super_admin' && dto.hotelId !== currentUser.hotelId) {
      throw new AuthError('No autorizado para crear en otro hotel')
    }
    const item = await this.repo.create(dto as any)
    await this.sockets.onHabitacionesCreated?.(item)
    await this.cache.delete(`habitaciones:list:${dto.hotelId}`)
    return item
  }

  async update(id: string, dto: UpdateHabitacionesDTO, currentUser: { id: string; role: string; hotelId?: string }): Promise<HabitacionesDTO> {
    const existing = await this.repo.findById(id)
    if (!existing) throw new NotFoundError('Habitación no encontrada')
    if (currentUser.role !== 'super_admin' && existing.hotelId !== currentUser.hotelId) {
      throw new AuthError('No autorizado')
    }
    const item = await this.repo.update(id, dto as any)
    if (!item) throw new NotFoundError('Habitación no encontrada')
    await this.sockets.onHabitacionesUpdated?.(item)
    await this.cache.delete(`habitaciones:list:${existing.hotelId}`)
    return item
  }

  async delete(id: string, currentUser: { id: string; role: string; hotelId?: string }): Promise<void> {
    const existing = await this.repo.findById(id)
    if (!existing) throw new NotFoundError('Habitación no encontrada')
    if (currentUser.role !== 'super_admin' && existing.hotelId !== currentUser.hotelId) {
      throw new AuthError('No autorizado')
    }
    const deleted = await this.repo.delete(id)
    if (!deleted) throw new NotFoundError('Habitación no encontrada')
    await this.sockets.onHabitacionesDeleted?.(id)
    await this.cache.delete(`habitaciones:list:${existing.hotelId}`)
  }
}
