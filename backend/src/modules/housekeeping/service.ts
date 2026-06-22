import type { RepositoryAdapter, Logger, CacheAdapter, Auth } from 'arckode-framework'
import { NotFoundError, AuthError } from 'arckode-framework'
import type { HousekeepingDTO, CreateHousekeepingDTO, UpdateHousekeepingDTO, HousekeepingQuery, HousekeepingPaginated } from './types'
import type { HousekeepingSockets } from './sockets'

const CACHE_TTL = 300

export class HousekeepingService {
  private sockets: HousekeepingSockets = {}

  constructor(
    private readonly repo: RepositoryAdapter<HousekeepingDTO>,
    private readonly logger: Logger,
    private readonly cache: CacheAdapter,
    private readonly userRepo: RepositoryAdapter<any>,
    private readonly auth: Auth,
  ) {}

  setSockets(s: Partial<HousekeepingSockets>): void {
    const next = s as Record<string, any>
    const cur = this.sockets as Record<string, any>
    for (const key of Object.keys(next)) {
      const h = next[key]
      if (!h) continue
      const prev = cur[key]
      cur[key] = prev
        ? async (...a: any[]) => {
            try { await prev(...a) } catch (e) { this.logger.error(`Socket chain error [${key}]`, e as any) }
            await h(...a)
          }
        : h
    }
  }

  async list(query: HousekeepingQuery, currentUser: { id: string; role: string; hotelId?: string }): Promise<HousekeepingPaginated> {
    const filters: Record<string, unknown> = {}
    if (query.status) filters.status = query.status
    if (query.type) filters.type = query.type
    if (query.priority) filters.priority = query.priority
    if (query.roomId) filters.roomId = query.roomId
    if (query.staffId) filters.staffId = query.staffId

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

    const cacheKey = `housekeeping:list:${hotelId || 'all'}`
    const cached = await this.cache.get(cacheKey)
    if (cached) return cached as HousekeepingPaginated

    const result = await this.repo.paginate(filters, { offset, limit })
    const response = { data: result.data, total: result.total, page, limit, pages: Math.ceil(result.total / limit) }
    await this.cache.set(cacheKey, response, CACHE_TTL)
    return response
  }

  async getById(id: string, currentUser: { id: string; role: string; hotelId?: string }): Promise<HousekeepingDTO> {
    const item = await this.repo.findById(id)
    if (!item) throw new NotFoundError('Tarea de housekeeping no encontrada')
    if (currentUser.role !== 'super_admin' && item.hotelId !== currentUser.hotelId) {
      throw new AuthError('No autorizado')
    }
    return item
  }

  async create(dto: CreateHousekeepingDTO, currentUser: { id: string; role: string; hotelId?: string }): Promise<HousekeepingDTO> {
    if (currentUser.role !== 'super_admin' && dto.hotelId !== currentUser.hotelId) {
      throw new AuthError('No autorizado para crear en otro hotel')
    }
    const item = await this.repo.create(dto as any)
    await this.sockets.onHousekeepingCreated?.(item)
    await this.cache.delete(`housekeeping:list:${dto.hotelId}`)
    return item
  }

  async update(id: string, dto: UpdateHousekeepingDTO, currentUser: { id: string; role: string; hotelId?: string }): Promise<HousekeepingDTO> {
    const existing = await this.repo.findById(id)
    if (!existing) throw new NotFoundError('Tarea de housekeeping no encontrada')
    if (currentUser.role !== 'super_admin' && existing.hotelId !== currentUser.hotelId) {
      throw new AuthError('No autorizado')
    }
    const item = await this.repo.update(id, dto as any)
    if (!item) throw new NotFoundError('Tarea de housekeeping no encontrada')
    await this.sockets.onHousekeepingUpdated?.(item)
    await this.cache.delete(`housekeeping:list:${existing.hotelId}`)
    return item
  }

  async delete(id: string, currentUser: { id: string; role: string; hotelId?: string }): Promise<void> {
    const existing = await this.repo.findById(id)
    if (!existing) throw new NotFoundError('Tarea de housekeeping no encontrada')
    if (currentUser.role !== 'super_admin' && existing.hotelId !== currentUser.hotelId) {
      throw new AuthError('No autorizado')
    }
    const deleted = await this.repo.delete(id)
    if (!deleted) throw new NotFoundError('Tarea de housekeeping no encontrada')
    await this.sockets.onHousekeepingDeleted?.(id)
    await this.cache.delete(`housekeeping:list:${existing.hotelId}`)
  }
}
