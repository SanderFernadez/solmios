// service.ts — Facade del módulo housekeeping.
// CRUD base acá; operaciones de tiempos/fotos/stats delegadas a usecases/ (D2/D5).
import type { RepositoryAdapter, Logger, CacheAdapter, Auth } from 'arckode-framework'
import { NotFoundError, AuthError, ValidationError } from 'arckode-framework'
import type { StorageService, FileUpload } from 'arckode-framework/modules/storage'
import type { HousekeepingDTO, CreateHousekeepingDTO, UpdateHousekeepingDTO, HousekeepingQuery, HousekeepingPaginated, StaffStats, StaffStatsQuery, HousekeepingUser } from './types'
import type { HousekeepingSockets } from './sockets'
import { bumpListVersion } from './usecases/cache'
import { ListUseCase } from './usecases/list'
import { CrudUseCase } from './usecases/crud'
import { withRoomInfo } from './usecases/room-info'
import { TimingsUseCase, assertTransition } from './usecases/timings'
import { PhotosUseCase } from './usecases/photos'
import { StatsUseCase } from './usecases/stats'
import { ApproveUseCase } from './usecases/approve'
import { ConfigListsUseCase } from './usecases/config-lists'
import { HousekeepingSettingsUseCase, type HousekeepingSettings, DEFAULT_MAX_VIDEO_SECONDS } from './usecases/settings'
import { VideoUseCase, type VideoUploadTicket } from './usecases/video'
import type { S3StorageAdapter } from '../../infrastructure/storage/s3-adapter'
import { assertStaffExists } from './usecases/staff'
import { auditSafely, type AuditPort } from '../../shared/usecases/audit'

const CACHE_TTL = 300

/** Sin `configRepo` no hay settings del hotel: se responde el default de fábrica. */
const FALLBACK_SETTINGS: HousekeepingSettings = {
  requireSupervisorPhoto: false,
  completionEvidence: 'photos',
  maxVideoSeconds: DEFAULT_MAX_VIDEO_SECONDS,
}

export class HousekeepingService {
  private sockets: HousekeepingSockets = {}
  private auditPort: AuditPort | null = null
  private readonly timings: TimingsUseCase
  private readonly photos: PhotosUseCase
  private readonly statsUc: StatsUseCase
  private readonly approveUc: ApproveUseCase
  private readonly configLists?: ConfigListsUseCase
  private readonly settingsUc?: HousekeepingSettingsUseCase
  /** Solo existe si hay settings (necesita leer el modo/duración del hotel). */
  private readonly videoUc?: VideoUseCase
  private readonly listUc: ListUseCase
  private readonly crud: CrudUseCase
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
    /** Adapter S3 (Backblaze). Sin él, el modo video no se puede usar: la app
     *  sube el archivo directo al bucket con una URL prefirmada. */
    videoStorage?: S3StorageAdapter,
  ) {
    this.employeeRepo = employeeRepo
    this.timings = new TimingsUseCase(
      repo,
      (item) => this.sockets.onHousekeepingUpdated?.(item) ?? Promise.resolve(),
      (h) => this.invalidateCache(h),
      this.employeeRepo,
    )
    this.crud = new CrudUseCase(
      repo,
      userRepo,
      {
        onCreated: (i) => this.sockets.onHousekeepingCreated?.(i) ?? Promise.resolve(),
        onUpdated: (i) => this.sockets.onHousekeepingUpdated?.(i) ?? Promise.resolve(),
        onDeleted: (id) => this.sockets.onHousekeepingDeleted?.(id) ?? Promise.resolve(),
        onAssigned: (i) => this.sockets.onTaskAssigned?.(i) ?? Promise.resolve(),
        invalidate: (h) => this.invalidateCache(h),
        audit: (existing, user, id) =>
          auditSafely(this.auditPort, this.logger, {
            hotelId: existing.hotelId, userId: user.id, action: 'housekeeping.delete',
            entity: 'housekeeping_task', entityId: id,
            detail: `Tarea de limpieza eliminada · habitación ${existing.roomId}` +
              `${existing.status ? ` · estado ${existing.status}` : ''}` +
              `${existing.staffId ? ` · asignada a ${existing.staffId}` : ''}`,
          }),
      },
      roomRepo,
    )
    this.photos = new PhotosUseCase(repo, logger, (h) => this.invalidateCache(h), storage)
    this.statsUc = new StatsUseCase(repo, cache, userRepo)
    this.listUc = new ListUseCase(repo, cache, userRepo, roomRepo)
    this.approveUc = new ApproveUseCase(repo)
    if (photoReqRepo && supplyRepo) {
      this.configLists = new ConfigListsUseCase(photoReqRepo, supplyRepo, logger, checklistRepo)
    }
    if (configRepo) {
      this.settingsUc = new HousekeepingSettingsUseCase(configRepo)
      this.videoUc = new VideoUseCase(repo, this.settingsUc, videoStorage)
    }
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

  // ─── Delegaciones a usecases ───────────────────────────────────────────────
  async getById(id: string, u: HousekeepingUser) { return this.crud.getById(id, u) }
  async create(dto: CreateHousekeepingDTO, u: HousekeepingUser) { return this.crud.create(dto, u) }
  async update(id: string, dto: UpdateHousekeepingDTO, u: HousekeepingUser) { return this.crud.update(id, dto, u) }
  async delete(id: string, u: HousekeepingUser) { return this.crud.delete(id, u) }

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
  async getSettings(h: string): Promise<HousekeepingSettings> { return this.settingsUc?.get(h) ?? { ...FALLBACK_SETTINGS } }
  async updateSettings(h: string, patch: Partial<HousekeepingSettings>): Promise<HousekeepingSettings> { return this.settingsUc?.update(h, patch) ?? { ...FALLBACK_SETTINGS } }

  // ─── Evidencia en video ───────────────────────────────────────────────────
  // Los bytes NO pasan por acá: se firma un permiso y la app sube directo al bucket.
  private video(): VideoUseCase {
    if (!this.videoUc) throw new ValidationError('Evidencia en video no disponible en este servidor')
    return this.videoUc
  }
  private async afterVideo(r: HousekeepingDTO) { await this.sockets.onHousekeepingUpdated?.(r); await this.invalidateCache(r.hotelId); return r }
  async requestVideoUploadUrl(id: string, i: { contentType: string; durationSeconds: number }, u: HousekeepingUser): Promise<VideoUploadTicket> { return this.video().requestUploadUrl(id, i, u) }
  async attachVideo(id: string, i: { url: string; path: string; durationSeconds: number; mimeType: string }, u: HousekeepingUser) { return this.afterVideo(await this.video().attachVideo(id, i, u)) }
  async removeVideo(id: string, u: HousekeepingUser) { return this.afterVideo(await this.video().removeVideo(id, u)) }
  async getVideoViewUrl(id: string, u: HousekeepingUser) { return this.video().getViewUrl(id, u) }

  private async invalidateCache(hotelId?: string) {
    // `delete` de una clave exacta ya no alcanza: la clave del listado incluye
    // filtros y página. Se bumpea la versión y las entradas viejas se huerfanizan.
    await bumpListVersion(this.cache, hotelId)
    await this.statsUc.bumpVersion(hotelId)
  }

  async invalidateListCache(hotelId?: string) { return this.invalidateCache(hotelId) }
}
