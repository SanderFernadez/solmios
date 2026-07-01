// mantenimiento/usecases/list.ts — Listado con filtros, sort y cache versionado por hotel.
// Extraído del service para mantenerlo < 200 líneas (God Object check de arckode analyze).
import type { RepositoryAdapter, CacheAdapter } from 'arckode-framework'
import { NotFoundError } from 'arckode-framework'
import type { MantenimientoDTO, MantenimientoQuery, MantenimientoPaginated } from '../types'
import { resolveHotelId } from '../helpers'

const CACHE_TTL = 300
// Versión de cache por hotel: cada mutación hace bump → las keys viejas (que incluyen la
// versión en su nombre) quedan huérfanas y expiran con CACHE_TTL. Evita cache poisoning
// entre queries con distintos filtros que antes compartían la misma key.
const CACHE_VERSION_TTL = 86_400

// Whitelist acotada de campos ordenables (el framework valida contra el modelo;
// esto además evita ORDER BY sobre columnas sensibles o inexistentes).
const SORTABLE_FIELDS = ['createdAt', 'updatedAt', 'priority', 'status', 'category', 'reportedDate', 'estimatedCost', 'title']

export class ListUseCase {
  constructor(
    private readonly repo: RepositoryAdapter<MantenimientoDTO>,
    private readonly cache: CacheAdapter,
    private readonly userRepo: { findById: (id: string) => Promise<{ hotelId?: string } | null> },
  ) {}

  async getVersion(hotelId: string): Promise<number> {
    const v = await this.cache.get(`mantenimiento:ver:${hotelId}`)
    return typeof v === 'number' ? v : 0
  }

  // Bump de versión por hotel → invalida todas las keys de listado de ese hotel de golpe.
  async invalidate(hotelId?: string): Promise<void> {
    if (!hotelId) return
    const v = await this.getVersion(hotelId)
    await this.cache.set(`mantenimiento:ver:${hotelId}`, v + 1, CACHE_VERSION_TTL)
  }

  async list(query: MantenimientoQuery, currentUser: { id: string; role: string; hotelId?: string }): Promise<MantenimientoPaginated> {
    const filters: Record<string, unknown> = {}
    if (query.status) filters.status = query.status
    if (query.category) filters.category = query.category
    if (query.priority) filters.priority = query.priority
    if (query.roomId) filters.roomId = query.roomId
    if (query.search) filters.title = { contains: query.search }

    const hotelId = await resolveHotelId(currentUser, this.userRepo)
    if (currentUser.role !== 'super_admin') {
      if (!hotelId) throw new NotFoundError('No hotel assigned')
      filters.hotelId = hotelId
    } else if (query.hotelId) {
      filters.hotelId = query.hotelId
    }

    const page = Math.max(query.page || 1, 1)
    const limit = Math.min(Math.max(query.limit || 20, 1), 100)
    const offset = (page - 1) * limit

    const orderBy = query.sortBy && SORTABLE_FIELDS.includes(query.sortBy)
      ? [{ field: query.sortBy, dir: query.sortOrder === 'asc' ? 'ASC' as const : 'DESC' as const }]
      : [{ field: 'createdAt', dir: 'DESC' as const }]

    // CacheKey único por query (versión del hotel + todos los parámetros) → sin colisión
    // entre filtros que antes compartían la misma key y se servían data cruzada.
    const ver = await this.getVersion(hotelId || 'all')
    const cacheKey = `mantenimiento:list:${hotelId || 'all'}:v${ver}:${query.status ?? '-'}:${query.category ?? '-'}:${query.priority ?? '-'}:${query.roomId ?? '-'}:${query.search ?? '-'}:${query.sortBy ?? '-'}:${query.sortOrder ?? '-'}:${page}:${limit}`
    const cached = await this.cache.get(cacheKey)
    if (cached) return cached as MantenimientoPaginated

    const result = await this.repo.paginate(filters, { offset, limit, orderBy })
    const totalPages = Math.ceil(result.total / limit)
    const response: MantenimientoPaginated = {
      data: result.data,
      pagination: { page, limit, total: result.total, totalPages, hasNext: page < totalPages, hasPrev: page > 1 },
    }
    await this.cache.set(cacheKey, response, CACHE_TTL)
    return response
  }
}
