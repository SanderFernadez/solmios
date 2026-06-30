// service.ts — Facade del módulo housekeeping.
// CRUD base acá; operaciones de tiempos/fotos/stats delegadas a usecases/ (D2/D5).
import type { RepositoryAdapter, Logger, CacheAdapter, Auth } from 'arckode-framework'
import { NotFoundError, AuthError, ValidationError } from 'arckode-framework'
import type { StorageService, FileUpload } from 'arckode-framework/modules/storage'
import type { HousekeepingDTO, CreateHousekeepingDTO, UpdateHousekeepingDTO, HousekeepingQuery, HousekeepingPaginated, StaffStats, StaffStatsQuery, HousekeepingUser } from './types'
import type { HousekeepingSockets } from './sockets'
import { TimingsUseCase, assertTransition } from './usecases/timings'
import { PhotosUseCase } from './usecases/photos'
import { StatsUseCase } from './usecases/stats'

const CACHE_TTL = 300

export class HousekeepingService {
  private sockets: HousekeepingSockets = {}
  private readonly timings: TimingsUseCase
  private readonly photos: PhotosUseCase
  private readonly statsUc: StatsUseCase
  private readonly employeeRepo?: RepositoryAdapter<any>

  constructor(
    private readonly repo: RepositoryAdapter<HousekeepingDTO>,
    private readonly logger: Logger,
    private readonly cache: CacheAdapter,
    private readonly userRepo: RepositoryAdapter<any>,
    private readonly auth: Auth,
    employeeRepo?: RepositoryAdapter<any>,
    storage?: StorageService,
  ) {
    this.employeeRepo = employeeRepo
    this.timings = new TimingsUseCase(
      repo,
      (item) => this.sockets.onHousekeepingUpdated?.(item) ?? Promise.resolve(),
      (h) => this.invalidateCache(h),
    )
    this.photos = new PhotosUseCase(repo, logger, (h) => this.invalidateCache(h), storage)
    this.statsUc = new StatsUseCase(repo, cache, userRepo)
  }

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

  async list(query: HousekeepingQuery, currentUser: HousekeepingUser): Promise<HousekeepingPaginated> {
    const filters: Record<string, unknown> = {}
    if (query.status) filters.status = query.status
    if (query.type) filters.type = query.type
    if (query.priority) filters.priority = query.priority
    if (query.roomId) filters.roomId = query.roomId
    if (query.staffId) filters.staffId = query.staffId

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

  async getById(id: string, currentUser: HousekeepingUser): Promise<HousekeepingDTO> {
    const item = await this.repo.findById(id)
    if (!item) throw new NotFoundError('Tarea de housekeeping no encontrada')
    if (currentUser.role !== 'super_admin' && item.hotelId !== currentUser.hotelId) throw new AuthError('No autorizado')
    return item
  }

  async create(dto: CreateHousekeepingDTO, currentUser: HousekeepingUser): Promise<HousekeepingDTO> {
    if (currentUser.role !== 'super_admin' && dto.hotelId !== currentUser.hotelId) {
      throw new AuthError('No autorizado para crear en otro hotel')
    }
    await this.assertStaffExists(dto.staffId, currentUser)
    const item = await this.repo.create(dto as any)
    await this.sockets.onHousekeepingCreated?.(item)
    await this.invalidateCache(dto.hotelId)
    return item
  }

  async update(id: string, dto: UpdateHousekeepingDTO, currentUser: HousekeepingUser): Promise<HousekeepingDTO> {
    const existing = await this.repo.findById(id)
    if (!existing) throw new NotFoundError('Tarea de housekeeping no encontrada')
    if (currentUser.role !== 'super_admin' && existing.hotelId !== currentUser.hotelId) throw new AuthError('No autorizado')
    if (dto.status && dto.status !== existing.status) assertTransition(existing.status, dto.status)
    await this.assertStaffExists(dto.staffId, currentUser)
    const item = await this.repo.update(id, dto as any)
    if (!item) throw new NotFoundError('Tarea de housekeeping no encontrada')
    await this.sockets.onHousekeepingUpdated?.(item)
    await this.invalidateCache(existing.hotelId)
    return item
  }

  async delete(id: string, currentUser: HousekeepingUser): Promise<void> {
    const existing = await this.repo.findById(id)
    if (!existing) throw new NotFoundError('Tarea de housekeeping no encontrada')
    if (currentUser.role !== 'super_admin' && existing.hotelId !== currentUser.hotelId) throw new AuthError('No autorizado')
    const deleted = await this.repo.delete(id)
    if (!deleted) throw new NotFoundError('Tarea de housekeeping no encontrada')
    await this.sockets.onHousekeepingDeleted?.(id)
    await this.invalidateCache(existing.hotelId)
  }

  // ─── Delegaciones a usecases (F3). FUTURE: cuando exista la app móvil del staff,
  // agregar 'staff' a los auth.authenticate de start/complete/photos en index.ts. ─
  async start(id: string, currentUser: HousekeepingUser): Promise<HousekeepingDTO> { return this.timings.start(id, currentUser) }
  async complete(id: string, currentUser: HousekeepingUser): Promise<HousekeepingDTO> { return this.timings.complete(id, currentUser) }
  async addPhoto(id: string, file: FileUpload, currentUser: HousekeepingUser): Promise<HousekeepingDTO> { return this.photos.addPhoto(id, file, currentUser) }
  async removePhoto(id: string, photoUrl: string, currentUser: HousekeepingUser): Promise<HousekeepingDTO> { return this.photos.removePhoto(id, photoUrl, currentUser) }
  async stats(query: StaffStatsQuery, currentUser: HousekeepingUser): Promise<StaffStats[]> { return this.statsUc.stats(query, currentUser) }

  // D4 — Validación blanda de staffId con ownership (sin FK física). Solo valida si
  // viene staffId y si el repo de empleados está disponible; no bloquea el connector
  // del sistema (crea tareas sin staff) ni datos legacy.
  private async assertStaffExists(staffId: string | undefined, currentUser: HousekeepingUser): Promise<void> {
    if (!staffId || !this.employeeRepo) return
    const profile = await this.employeeRepo.findById(staffId).catch(() => null)
    if (!profile) throw new ValidationError('staffId no corresponde a un empleado válido')
    if (currentUser.role !== 'super_admin' && profile.hotelId !== currentUser.hotelId) {
      throw new AuthError('staffId no pertenece a tu hotel')
    }
  }

  private async invalidateCache(hotelId?: string): Promise<void> {
    await this.cache.delete(`housekeeping:list:${hotelId}`)
    await this.statsUc.bumpVersion(hotelId)
  }
}
