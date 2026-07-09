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
import { ApproveUseCase } from './usecases/approve'
import { ConfigListsUseCase } from './usecases/config-lists'

const CACHE_TTL = 300

export class HousekeepingService {
  private sockets: HousekeepingSockets = {}
  private readonly timings: TimingsUseCase
  private readonly photos: PhotosUseCase
  private readonly statsUc: StatsUseCase
  private readonly approveUc: ApproveUseCase
  private readonly configLists?: ConfigListsUseCase
  private readonly employeeRepo?: RepositoryAdapter<any>

  constructor(
    private readonly repo: RepositoryAdapter<HousekeepingDTO>,
    private readonly logger: Logger,
    private readonly cache: CacheAdapter,
    private readonly userRepo: RepositoryAdapter<any>,
    private readonly auth: Auth,
    employeeRepo?: RepositoryAdapter<any>,
    storage?: StorageService,
    photoReqRepo?: RepositoryAdapter<any>,
    supplyRepo?: RepositoryAdapter<any>,
  ) {
    this.employeeRepo = employeeRepo
    this.timings = new TimingsUseCase(
      repo,
      (item) => this.sockets.onHousekeepingUpdated?.(item) ?? Promise.resolve(),
      (h) => this.invalidateCache(h),
      this.employeeRepo,
    )
    this.photos = new PhotosUseCase(repo, logger, (h) => this.invalidateCache(h), storage)
    this.statsUc = new StatsUseCase(repo, cache, userRepo)
    this.approveUc = new ApproveUseCase(repo)
    if (photoReqRepo && supplyRepo) {
      this.configLists = new ConfigListsUseCase(photoReqRepo, supplyRepo, logger)
    }
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

  // ─── Delegaciones a usecases ───────────────────────────────────────────────
  async start(id: string, u: HousekeepingUser) { return this.timings.start(id, u) }
  async complete(id: string, u: HousekeepingUser) { return this.timings.complete(id, u) }
  async addPhoto(id: string, file: FileUpload, u: HousekeepingUser) { return this.photos.addPhoto(id, file, u) }
  async removePhoto(id: string, url: string, u: HousekeepingUser) { return this.photos.removePhoto(id, url, u) }
  async stats(q: StaffStatsQuery, u: HousekeepingUser) { return this.statsUc.stats(q, u) }

  // ─── Aprobación y presencia ───────────────────────────────────────────────
  async approve(id: string, userId: string, note?: string) {
    const result = await this.approveUc.approve(id, userId, note)
    await this.sockets.onHousekeepingUpdated?.(result)
    await this.invalidateCache(result.hotelId)
    return result
  }
  async markPresence(id: string, userId: string) { return this.approveUc.markPresence(id, userId) }
  async reportIssue(id: string, desc: string, type: string) { return this.approveUc.reportIssue(id, desc, type) }

  // ─── Config lists (photo requirements + supply lists) ─────────────────────
  async getPhotoRequirements(h: string, rt?: string) { return this.configLists?.getPhotoRequirements(h, rt) ?? [] }
  async upsertPhotoRequirements(h: string, items: any[]) { return this.configLists?.upsertPhotoRequirements(h, items) ?? [] }
  async getSupplyLists(h: string, rt?: string) { return this.configLists?.getSupplyLists(h, rt) ?? [] }
  async upsertSupplyLists(h: string, rt: string, items: any[]) { return this.configLists?.upsertSupplyLists(h, rt, items) ?? [] }

  /**
   * `staffId` es el id de un USUARIO, no el de un `employee_profile`.
   *
   * Así lo manda la app (`?staffId=<users.id>`) y así lo compara `list()` contra
   * la columna `housekeeping.staffId`. Validarlo con `employeeRepo.findById()`
   * lo buscaba por la clave primaria de otra tabla: no coincidía nunca, y
   * asignarle una tarea a una camarera real fallaba siempre con
   * "staffId no corresponde a un empleado válido". Con `employee_profiles`
   * prácticamente vacío en producción, no había forma de asignar ninguna tarea.
   */
  private async assertStaffExists(staffId: string | undefined, currentUser: HousekeepingUser): Promise<void> {
    if (!staffId) return
    const staff = await this.userRepo.findById(staffId).catch(() => null)
    if (!staff) throw new ValidationError('staffId no corresponde a un empleado válido')
    if (currentUser.role !== 'super_admin' && staff.hotelId !== currentUser.hotelId) {
      throw new AuthError('staffId no pertenece a tu hotel')
    }
  }

  private async invalidateCache(hotelId?: string) {
    await this.cache.delete(`housekeeping:list:${hotelId}`)
    await this.statsUc.bumpVersion(hotelId)
  }

  async invalidateListCache(hotelId?: string) { return this.invalidateCache(hotelId) }
}
