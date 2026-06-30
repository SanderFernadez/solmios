// mantenimiento/service.ts — Facade del módulo. CRUD + delegación a usecases.
import type { RepositoryAdapter, Logger, CacheAdapter, Auth } from 'arckode-framework'
import { NotFoundError } from 'arckode-framework'
import type {
  MantenimientoDTO, CreateMantenimientoDTO, UpdateMantenimientoDTO,
  MantenimientoQuery, MantenimientoPaginated,
  MaintenanceAuditDTO,
} from './types'
import type { MantenimientoSockets } from './sockets'
import type { StorageService, FileUpload } from 'arckode-framework/modules/storage'
import { TimingsUseCase, assertTransition } from './usecases/timings'
import { AuditUseCase } from './usecases/audit'
import { PhotosUseCase } from './usecases/photos'
import { StatsUseCase } from './usecases/stats'
import { assertOwnership, resolveHotelId } from './helpers'

const CACHE_TTL = 300

export class MantenimientoService {
  private sockets: MantenimientoSockets = {}
  private readonly timings: TimingsUseCase
  private readonly audit: AuditUseCase
  private readonly photos: PhotosUseCase
  private readonly statsUc: StatsUseCase

  constructor(
    private readonly repo: RepositoryAdapter<MantenimientoDTO>,
    private readonly logger: Logger,
    private readonly cache: CacheAdapter,
    private readonly userRepo: RepositoryAdapter<any>,
    private readonly auth: Auth,
    private readonly auditRepo: RepositoryAdapter<MaintenanceAuditDTO>,
    storage?: StorageService,
  ) {
    this.timings = new TimingsUseCase(
      repo,
      (item) => this.sockets.onMantenimientoUpdated?.(item) ?? Promise.resolve(),
      (hotelId) => this.invalidateCache(hotelId),
    )
    this.audit = new AuditUseCase(auditRepo, repo, logger)
    this.photos = new PhotosUseCase(
      repo, logger,
      (hotelId) => this.invalidateCache(hotelId),
      storage,
    )
    this.statsUc = new StatsUseCase(repo)
  }

  setSockets(s: Partial<MantenimientoSockets>): void {
    const next = s as Record<string, any>
    const cur = this.sockets as Record<string, any>
    for (const key of Object.keys(next)) {
      const h = next[key]
      if (!h) continue
      const prev = cur[key]
      cur[key] = prev ? async (...a: any[]) => { await prev(...a); await h(...a) } : h
    }
  }

  private async invalidateCache(hotelId?: string): Promise<void> {
    await this.cache.delete(`mantenimiento:list:${hotelId || 'all'}`)
  }

  private async assertOrderAccess(id: string, user: { id: string; role: string; hotelId?: string }): Promise<MantenimientoDTO> {
    const item = await this.repo.findById(id)
    if (!item) throw new NotFoundError('Ticket de mantenimiento no encontrado')
    assertOwnership(item.hotelId, user)
    return item
  }

  private async logUpdateAudit(
    id: string, hotelId: string, userId: string,
    existing: MantenimientoDTO, dto: UpdateMantenimientoDTO,
  ): Promise<void> {
    if (dto.status && dto.status !== existing.status) {
      assertTransition(existing.status, dto.status)
      await this.audit.log(id, hotelId, userId, 'status_change', existing.status, dto.status)
    }
    if (dto.assignedTo !== undefined && dto.assignedTo !== existing.assignedTo) {
      await this.audit.log(id, hotelId, userId, 'assignment', existing.assignedTo ?? null, dto.assignedTo ?? null)
    }
    if (dto.priority && dto.priority !== existing.priority) {
      await this.audit.log(id, hotelId, userId, 'priority_change', existing.priority ?? null, dto.priority)
    }
  }

  // ─── CRUD ─────────────────────────────────────────────
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
    const cacheKey = `mantenimiento:list:${hotelId || 'all'}`
    const cached = await this.cache.get(cacheKey)
    if (cached) return cached as MantenimientoPaginated

    const result = await this.repo.paginate(filters, { offset, limit })
    const totalPages = Math.ceil(result.total / limit)
    const response = {
      data: result.data,
      pagination: { page, limit, total: result.total, totalPages, hasNext: page < totalPages, hasPrev: page > 1 },
    }
    await this.cache.set(cacheKey, response, CACHE_TTL)
    return response
  }

  async getById(id: string, currentUser: { id: string; role: string; hotelId?: string }): Promise<MantenimientoDTO> {
    return this.assertOrderAccess(id, currentUser)
  }

  async create(dto: CreateMantenimientoDTO, currentUser: { id: string; role: string; hotelId?: string }): Promise<MantenimientoDTO> {
    if (currentUser.role !== 'super_admin' && dto.hotelId !== currentUser.hotelId) {
      throw new NotFoundError('No autorizado para crear en otro hotel')
    }
    const item = await this.repo.create(dto as any)
    await this.audit.log(item.id, dto.hotelId, currentUser.id, 'created', null, item.title)
    await this.sockets.onMantenimientoCreated?.(item)
    await this.invalidateCache(dto.hotelId)
    return item
  }

  async update(id: string, dto: UpdateMantenimientoDTO, currentUser: { id: string; role: string; hotelId?: string }): Promise<MantenimientoDTO> {
    const existing = await this.assertOrderAccess(id, currentUser)
    await this.logUpdateAudit(id, existing.hotelId, currentUser.id, existing, dto)
    const item = await this.repo.update(id, dto as any)
    if (!item) throw new NotFoundError('Ticket de mantenimiento no encontrado')
    await this.sockets.onMantenimientoUpdated?.(item)
    await this.invalidateCache(existing.hotelId)
    return item
  }

  async delete(id: string, currentUser: { id: string; role: string; hotelId?: string }): Promise<void> {
    const existing = await this.assertOrderAccess(id, currentUser)
    await this.repo.delete(id)
    await this.sockets.onMantenimientoDeleted?.(id)
    await this.invalidateCache(existing.hotelId)
  }

  // ─── Timer ────────────────────────────────────────────
  async start(id: string, currentUser: { id: string; role: string; hotelId?: string }): Promise<MantenimientoDTO> {
    const item = await this.timings.start(id, currentUser)
    await this.audit.log(id, item.hotelId, currentUser.id, 'status_change', 'open', 'in_progress')
    return item
  }

  async complete(id: string, currentUser: { id: string; role: string; hotelId?: string }, notes?: string): Promise<MantenimientoDTO> {
    const existing = await this.assertOrderAccess(id, currentUser)
    const item = await this.timings.complete(id, currentUser, notes)
    await this.audit.log(id, item.hotelId, currentUser.id, 'status_change', existing.status, 'closed')
    if (notes) await this.audit.log(id, item.hotelId, currentUser.id, 'notes_added', null, notes)
    return item
  }

  // ─── Notes ────────────────────────────────────────────
  async addNotes(id: string, notes: string, currentUser: { id: string; role: string; hotelId?: string }): Promise<MantenimientoDTO> {
    const existing = await this.assertOrderAccess(id, currentUser)
    const item = await this.repo.update(id, { notes } as any)
    if (!item) throw new NotFoundError('Ticket de mantenimiento no encontrado')
    await this.audit.log(id, existing.hotelId, currentUser.id, 'notes_added', existing.notes ?? null, notes)
    await this.sockets.onMantenimientoUpdated?.(item)
    await this.invalidateCache(existing.hotelId)
    return item
  }

  // ─── Photos ───────────────────────────────────────────
  async addPhoto(id: string, file: FileUpload, type: string, currentUser: { id: string; role: string; hotelId?: string }): Promise<MantenimientoDTO> {
    const item = await this.photos.add(id, file, type, currentUser)
    await this.audit.log(id, item.hotelId, currentUser.id, 'photo_added', null, type)
    return item
  }

  // ─── Audit ────────────────────────────────────────────
  async getAuditHistory(orderId: string, currentUser: { id: string; role: string; hotelId?: string }): Promise<MaintenanceAuditDTO[]> {
    return this.audit.getHistory(orderId, currentUser)
  }

  // ─── Stats ────────────────────────────────────────────
  async getStats(hotelId: string) {
    return this.statsUc.getStats(hotelId)
  }
}
