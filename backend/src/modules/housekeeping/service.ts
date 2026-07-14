// service.ts — Facade del módulo housekeeping.
// CRUD base acá; operaciones de tiempos/fotos/stats delegadas a usecases/ (D2/D5).
import type { RepositoryAdapter, Logger, CacheAdapter, Auth } from 'arckode-framework'
import { NotFoundError, AuthError } from 'arckode-framework'
import type { StorageService, FileUpload } from 'arckode-framework/modules/storage'
import type { HousekeepingDTO, CreateHousekeepingDTO, UpdateHousekeepingDTO, HousekeepingQuery, HousekeepingPaginated, StaffStats, StaffStatsQuery, HousekeepingUser } from './types'
import type { HousekeepingSockets } from './sockets'
import { bumpListVersion } from './usecases/cache'
import { ListUseCase } from './usecases/list'
import { withRoomInfo } from './usecases/room-info'
import { TimingsUseCase, assertTransition } from './usecases/timings'
import { PhotosUseCase } from './usecases/photos'
import { StatsUseCase } from './usecases/stats'
import { ApproveUseCase } from './usecases/approve'
import { ConfigListsUseCase } from './usecases/config-lists'
import { HousekeepingSettingsUseCase, type HousekeepingSettings } from './usecases/settings'
import { assertStaffExists } from './usecases/staff'
import { auditSafely, type AuditPort } from '../../shared/usecases/audit'

const CACHE_TTL = 300

export class HousekeepingService {
  private sockets: HousekeepingSockets = {}
  private auditPort: AuditPort | null = null
  private readonly timings: TimingsUseCase
  private readonly photos: PhotosUseCase
  private readonly statsUc: StatsUseCase
  private readonly approveUc: ApproveUseCase
  private readonly configLists?: ConfigListsUseCase
  private readonly settingsUc?: HousekeepingSettingsUseCase
  private readonly listUc: ListUseCase
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
    private readonly roomRepo?: RepositoryAdapter<any>,
    checklistRepo?: RepositoryAdapter<any>,
    configRepo?: RepositoryAdapter<any>,
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
    this.listUc = new ListUseCase(repo, cache, userRepo, roomRepo)
    this.approveUc = new ApproveUseCase(repo)
    if (photoReqRepo && supplyRepo) {
      this.configLists = new ConfigListsUseCase(photoReqRepo, supplyRepo, logger, checklistRepo)
    }
    if (configRepo) this.settingsUc = new HousekeepingSettingsUseCase(configRepo)
  }

  /** Conecta el audit log. Lo inyecta el connector `housekeeping-auditlog`. */
  setAuditDeps(port: AuditPort): void { this.auditPort = port }

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
    return this.listUc.list(query, currentUser)
  }

  async getById(id: string, currentUser: HousekeepingUser): Promise<HousekeepingDTO> {
    // NO `findById`: en este ORM la lectura de UNA fila devuelve los campos
    // json/text (`cleaningItems`, `notes`, `supervisorNote`, `photos`) en null,
    // mientras que la lectura en lote (`paginate`, que usa el listado) los
    // deserializa bien. El detalle de la app se sirve de acá, así que sin esto la
    // camarera abría una tarea SIN checklist tildado y SIN el motivo de rechazo.
    // Se lee por el mismo camino que el listado, filtrando por id.
    const result = await this.repo.paginate({ id }, { offset: 0, limit: 1 })
    const item = result.data[0]
    if (!item) throw new NotFoundError('Tarea de housekeeping no encontrada')
    if (currentUser.role !== 'super_admin' && item.hotelId !== currentUser.hotelId) throw new AuthError('No autorizado')
    // El detalle también muestra "Hab. X": sin esto el título quedaba vacío.
    const [enriched] = await withRoomInfo(this.roomRepo, [item])
    return enriched as HousekeepingDTO
  }

  async create(dto: CreateHousekeepingDTO, currentUser: HousekeepingUser): Promise<HousekeepingDTO> {
    if (currentUser.role !== 'super_admin' && dto.hotelId !== currentUser.hotelId) {
      throw new AuthError('No autorizado para crear en otro hotel')
    }
    await assertStaffExists(this.userRepo, dto.staffId, currentUser)
    const item = await this.repo.create(dto as any)
    await this.sockets.onHousekeepingCreated?.(item)
    // Nace ya asignada: la camarera tiene que enterarse.
    if (dto.staffId) await this.sockets.onTaskAssigned?.(item)
    await this.invalidateCache(dto.hotelId)
    return item
  }

  async update(id: string, dto: UpdateHousekeepingDTO, currentUser: HousekeepingUser): Promise<HousekeepingDTO> {
    const existing = await this.repo.findById(id)
    if (!existing) throw new NotFoundError('Tarea de housekeeping no encontrada')
    if (currentUser.role !== 'super_admin' && existing.hotelId !== currentUser.hotelId) throw new AuthError('No autorizado')
    if (dto.status && dto.status !== existing.status) assertTransition(existing.status, dto.status)
    await assertStaffExists(this.userRepo, dto.staffId, currentUser)
    const item = await this.repo.update(id, dto as any)
    if (!item) throw new NotFoundError('Tarea de housekeeping no encontrada')
    await this.sockets.onHousekeepingUpdated?.(item)
    // Solo cuando cambia de dueño: un `update` de estado no es una asignación.
    if (dto.staffId && dto.staffId !== existing.staffId) {
      await this.sockets.onTaskAssigned?.(item)
    }
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
    // Con la tarea se van sus tiempos, fotos y checklist: es la evidencia de la limpieza.
    await auditSafely(this.auditPort, this.logger, {
      hotelId: existing.hotelId, userId: currentUser.id, action: 'housekeeping.delete',
      entity: 'housekeeping_task', entityId: id,
      detail: `Tarea de limpieza eliminada · habitación ${existing.roomId}` +
        `${existing.status ? ` · estado ${existing.status}` : ''}` +
        `${existing.staffId ? ` · asignada a ${existing.staffId}` : ''}`,
    })
  }

  // ─── Delegaciones a usecases ───────────────────────────────────────────────
  async start(id: string, u: HousekeepingUser) { return this.timings.start(id, u) }
  async pause(id: string, u: HousekeepingUser) { return this.timings.pause(id, u) }
  async resume(id: string, u: HousekeepingUser) { return this.timings.resume(id, u) }
  async complete(id: string, u: HousekeepingUser) { return this.timings.complete(id, u) }
  async addPhoto(id: string, file: FileUpload, areaId: string, u: HousekeepingUser) { return this.photos.addPhoto(id, file, areaId, u) }
  async removePhoto(id: string, url: string, u: HousekeepingUser) { return this.photos.removePhoto(id, url, u) }
  async stats(q: StaffStatsQuery, u: HousekeepingUser) { return this.statsUc.stats(q, u) }

  // ─── Aprobación y presencia ───────────────────────────────────────────────
  async approve(id: string, userId: string, note: string | undefined, rating: number) {
    const result = await this.approveUc.approve(id, userId, note, rating)
    await this.sockets.onHousekeepingUpdated?.(result)
    await this.invalidateCache(result.hotelId)
    return result
  }
  async reject(id: string, userId: string, note?: string) {
    const result = await this.approveUc.reject(id, userId, note)
    await this.sockets.onHousekeepingUpdated?.(result)
    // La camarera tiene que enterarse de que su limpieza volvió.
    if (result.staffId) await this.sockets.onTaskAssigned?.(result)
    await this.invalidateCache(result.hotelId)
    return result
  }
  async markPresence(id: string, userId: string) { return this.approveUc.markPresence(id, userId) }
  async reportIssue(id: string, desc: string, type: string, reporter: { id: string; hotelId?: string; role: string }) {
    return this.approveUc.reportIssue(id, desc, type, reporter, this.sockets.onIssueReported)
  }

  // ─── Config lists (photo requirements + supply lists) ─────────────────────
  async getPhotoRequirements(h: string, rt?: string) { return this.configLists?.getPhotoRequirements(h, rt) ?? [] }
  async upsertPhotoRequirements(h: string, items: any[]) { return this.configLists?.upsertPhotoRequirements(h, items) ?? [] }
  async getSupplyLists(h: string, rt?: string) { return this.configLists?.getSupplyLists(h, rt) ?? [] }
  async upsertSupplyLists(h: string, rt: string, items: any[]) { return this.configLists?.upsertSupplyLists(h, rt, items) ?? [] }
  async getChecklist(h: string, rt?: string) { return this.configLists?.getChecklist(h, rt) ?? [] }
  async upsertChecklist(h: string, rt: string, items: any[]) { return this.configLists?.upsertChecklist(h, rt, items) ?? [] }
  async getSettings(h: string): Promise<HousekeepingSettings> { return this.settingsUc?.get(h) ?? { requireSupervisorPhoto: false } }
  async updateSettings(h: string, patch: Partial<HousekeepingSettings>): Promise<HousekeepingSettings> { return this.settingsUc?.update(h, patch) ?? { requireSupervisorPhoto: false } }

  private async invalidateCache(hotelId?: string) {
    // `delete` de una clave exacta ya no alcanza: la clave del listado incluye
    // filtros y página. Se bumpea la versión y las entradas viejas se huerfanizan.
    await bumpListVersion(this.cache, hotelId)
    await this.statsUc.bumpVersion(hotelId)
  }

  async invalidateListCache(hotelId?: string) { return this.invalidateCache(hotelId) }
}
