// housekeeping/usecases/list.ts — Listado paginado de tareas.

import type { RepositoryAdapter, CacheAdapter } from 'arckode-framework'
import { AuthError } from 'arckode-framework'
import type { HousekeepingDTO, HousekeepingQuery, HousekeepingPaginated, HousekeepingUser } from '../types'
import { listCacheKey } from './cache'
import { withRoomInfo } from './room-info'

const CACHE_TTL = 300
const DEFAULT_LIMIT = 20
const MAX_LIMIT = 100

export class ListUseCase {
  constructor(
    private readonly repo: RepositoryAdapter<HousekeepingDTO>,
    private readonly cache: CacheAdapter,
    private readonly userRepo: RepositoryAdapter<any>,
    private readonly roomRepo?: RepositoryAdapter<any>,
  ) {}

  async list(query: HousekeepingQuery, currentUser: HousekeepingUser): Promise<HousekeepingPaginated> {
    const filters: Record<string, unknown> = {}
    if (query.status) filters.status = query.status
    if (query.type) filters.type = query.type
    if (query.priority) filters.priority = query.priority
    if (query.roomId) filters.roomId = query.roomId
    // La app manda `?staffId=<users.id>` para "Mis Tareas".
    if (query.staffId) filters.staffId = query.staffId

    const hotelId = await this.resolveHotelId(query, filters, currentUser)

    const page = Math.max(query.page || 1, 1)
    const limit = Math.min(Math.max(query.limit || DEFAULT_LIMIT, 1), MAX_LIMIT)
    const offset = (page - 1) * limit

    // La clave lleva filtros y página: con `housekeeping:list:<hotelId>` a secas,
    // la primera consulta (sin filtros) cacheaba las tareas de TODO el hotel y
    // `?staffId=` recibía esa misma lista.
    const cacheKey = await listCacheKey(this.cache, hotelId, filters, page, limit)
    const cached = await this.cache.get(cacheKey)
    if (cached) return cached as HousekeepingPaginated

    const result = await this.repo.paginate(filters, { offset, limit })
    const data = await withRoomInfo(this.roomRepo, result.data)
    const response = { data, total: result.total, page, limit, pages: Math.ceil(result.total / limit) }
    await this.cache.set(cacheKey, response, CACHE_TTL)
    return response
  }

  /** Multi-tenant: nadie ve las tareas de otro hotel, salvo el super_admin. */
  private async resolveHotelId(
    query: HousekeepingQuery,
    filters: Record<string, unknown>,
    currentUser: HousekeepingUser,
  ): Promise<string | undefined> {
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
    return hotelId
  }
}
