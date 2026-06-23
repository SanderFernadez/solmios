// canales/service.ts — Facade pública del módulo (orquestador)
// Delega las operaciones de Channex a usecases/channex.ts (client API).
// Aquí vive solo: config por hotel + CRUD sobre la config + orquestación.
// NO sabe de HTTP. NO importa de otros módulos. Recibe dependencias por constructor.

import type { RepositoryAdapter, Logger, CacheAdapter, ORM, Auth } from 'arckode-framework'
import { NotFoundError } from 'arckode-framework'
import type {
  CanalesDTO, CreateCanalesDTO, UpdateCanalesDTO, CanalesQuery, CanalesPaginated,
  ChannelsResultDTO, RoomTypeSummary, SyncResultDTO,
  TestConnectionResultDTO, MappingDetailDTO, GroupDTO, OTAChannelCreateDTO, OTAChannelResultDTO,
  OTAChannelMeta, BookingRevisionDTO, BookingIngestionResult, CurrentUser,
} from './types'
import type { CanalesSockets } from './sockets'
import { ChannexUseCase } from './usecases/channex'
import { applyBookingRevision } from './usecases/booking-ingestion'
import { pushAvailabilityForRoomType, pushAvailabilityForRoom, type AvailabilityDeps } from './usecases/availability'

export class CanalesService {
  private sockets: CanalesSockets = {}
  private readonly channex: ChannexUseCase

  constructor(
    private readonly repo: RepositoryAdapter<CanalesDTO>,
    private readonly userRepo: RepositoryAdapter<any>,
    private readonly logger: Logger,
    private readonly cache: CacheAdapter,
    private readonly auth: Auth,
    private readonly orm?: ORM,
  ) {
    this.channex = new ChannexUseCase(logger)
  }

  setSockets(s: Partial<CanalesSockets>): void {
    const next = s as Record<string, any>
    const cur = this.sockets as Record<string, any>
    for (const key of Object.keys(next)) {
      const h = next[key]
      if (!h) continue
      const prev = cur[key]
      cur[key] = prev ? async (...a: any[]) => { await prev(...a); await h(...a) } : h
    }
  }

  // ─── Config por hotel ────────────────────────────────────────────────
  async getConfig(hotelId: string): Promise<CanalesDTO | undefined> {
    const cfg = await this.repo.findOne({ hotelId } as any)
    return cfg ?? undefined
  }

  private async upsertConfig(hotelId: string, patch: Partial<CanalesDTO>): Promise<CanalesDTO> {
    const cfg = await this.getConfig(hotelId)
    if (!cfg) return (await this.repo.create({ id: crypto.randomUUID(), hotelId, syncEnabled: 1, ...patch } as any))!
    return (await this.repo.update(cfg.id, patch as any))!
  }

  // ─── Operaciones Channex (delegan al usecase) ────────────────────────
  async listChannels(hotelId: string): Promise<ChannelsResultDTO> {
    const catalog = await this.getOTACatalog()
    return this.channex.listChannels(await this.getConfig(hotelId), catalog)
  }

  private async getOTACatalog(): Promise<OTAChannelMeta[]> {
    try {
      if (!this.orm) return []
      const rows = await this.orm.findMany('Configuration', { hotelId: 'platform', clave: 'canales_ota' })
      const cfg = (rows as any[])?.[0]
      if (!cfg) return []
      const val = typeof cfg.value === 'string' ? JSON.parse(cfg.value) : cfg.value
      return Array.isArray(val) ? val : []
    } catch { return [] }
  }

  async getFeed(): Promise<{ pendingBookings: number }> {
    return this.channex.getFeed()
  }

  async syncProperty(hotelId: string, hotel: { name: string; currency?: string; email?: string; address?: string; timezone?: string }, rooms: RoomTypeSummary[]): Promise<SyncResultDTO> {
    const cfg = await this.getConfig(hotelId)
    const { result, newPropertyId } = await this.channex.syncProperty(hotel, rooms, cfg)
    if (newPropertyId) await this.upsertConfig(hotelId, { channexPropertyId: newPropertyId, syncEnabled: 1, lastSync: new Date().toISOString() })
    else await this.upsertConfig(hotelId, { lastSync: new Date().toISOString() })
    return result
  }

  async pushRate(hotelId: string, roomType: string, precioBase: number): Promise<{ pushed: boolean }> {
    return this.channex.pushRate(await this.getConfig(hotelId), roomType, precioBase)
  }

  // Push de availability: recálculo + push. Disparado por reservas/checkin/checkout/bloqueos. Lógica en usecases/availability.ts.
  private availDeps(): AvailabilityDeps {
    return {
      findMany: (m, q) => this.orm!.findMany(m, q),
      getConfig: h => this.getConfig(h),
      pushToChannex: (c, rt, r) => this.channex.pushAvailability(c, rt, r),
    }
  }
  async pushAvailability(hotelId: string, roomType: string): Promise<{ pushed: boolean }> {
    return this.orm ? pushAvailabilityForRoomType(this.availDeps(), hotelId, roomType) : { pushed: false }
  }
  async pushAvailabilityByRoom(hotelId: string, roomId: string): Promise<{ pushed: boolean }> {
    return this.orm ? pushAvailabilityForRoom(this.availDeps(), hotelId, roomId) : { pushed: false }
  }

  // ─── Channel API ─────────────────────────────────────────────────────
  async testConnection(hotelId: string, channel: string, otaHotelId: string): Promise<TestConnectionResultDTO> {
    return this.channex.testConnection(await this.getConfig(hotelId), { channel, hotel_id: otaHotelId })
  }
  async getMappingDetails(hotelId: string, channel: string, otaHotelId: string): Promise<{ success: boolean; rooms: MappingDetailDTO[]; error?: string }> {
    return this.channex.getMappingDetails(await this.getConfig(hotelId), channel, otaHotelId)
  }
  async listGroups(hotelId: string): Promise<GroupDTO[]> {
    return this.channex.listGroups(await this.getConfig(hotelId))
  }
  async createOTAChannel(hotelId: string, dto: OTAChannelCreateDTO): Promise<OTAChannelResultDTO> {
    return this.channex.createOTAChannel(await this.getConfig(hotelId), dto)
  }
  async deactivateChannel(hotelId: string, channelId: string): Promise<{ success: boolean; message: string }> {
    return this.channex.deactivateChannel(await this.getConfig(hotelId), channelId)
  }

  // ─── Bookings ──────────────────────────────────────────────────────
  async getBookings(hotelId: string): Promise<BookingRevisionDTO[]> {
    const cfg = await this.getConfig(hotelId)
    return this.channex.fetchBookingFeed(cfg?.channexApiKey || process.env.CHANNEX_API_KEY || '')
  }
  async ingestBookings(hotelId: string): Promise<BookingIngestionResult> {
    const cfg = await this.getConfig(hotelId)
    const key = cfg?.channexApiKey || process.env.CHANNEX_API_KEY || ''
    if (!this.orm) throw new Error('ORM no disponible')
    const orm = this.orm
    return this.channex.ingestBookings(cfg, async (dto: any) => {
      await applyBookingRevision({ orm, channex: this.channex, hotelId, apiKey: key }, dto)
    })
  }

  // ─── iFrame ────────────────────────────────────────────────────────
  async getIframeToken(hotelId: string, username: string): Promise<string | null> {
    return this.channex.generateIframeToken(await this.getConfig(hotelId), username)
  }
  /** Devuelve el channexPropertyId configurado para el hotel (null si no sincronizó). */
  async getPropertyId(hotelId: string): Promise<string | null> {
    return (await this.getConfig(hotelId))?.channexPropertyId || null
  }
  async getChannelDetail(hotelId: string, channelId: string): Promise<any | null> {
    return this.channex.getChannelDetail(await this.getConfig(hotelId), channelId)
  }

  // ─── CRUD estándar sobre la config (admin) ───────────────────────────
  async list(query?: CanalesQuery, user?: CurrentUser): Promise<CanalesPaginated> {
    const page = query?.page ?? 1
    const limit = query?.limit ?? 20
    const offset = (page - 1) * limit
    const filters: Record<string, unknown> = {}
    if (user && user.role !== 'super_admin') {
      // hotelId llega en el JWT (HotelAuth). Sin findById: tokens legacy sin hotelId → '__none__' (lista vacía, sin fuga).
      filters.hotelId = user.hotelId ?? '__none__'
    } else if (query?.hotelId !== undefined) {
      filters.hotelId = query.hotelId
    }
    const result = await this.repo.paginate(filters, { limit, offset })
    return { data: result.data, pagination: { page, limit, total: result.total, totalPages: result.pages, hasNext: offset + limit < result.total, hasPrev: page > 1 } }
  }

  async getById(id: string, user: CurrentUser): Promise<CanalesDTO> {
    const item = await this.repo.findById(id)
    if (!item) throw new NotFoundError('Canales no encontrado')
    const me = await this.userRepo.findById(user.id)
    this.auth.assertOwnership(item.hotelId, (me as any)?.hotelId ?? '', user.role, 'super_admin')
    return item
  }

  async create(dto: CreateCanalesDTO): Promise<CanalesDTO> {
    const item = await this.repo.create(dto as Omit<CanalesDTO, 'id'>)
    await this.cache.delete('canales:list')
    return item
  }

  async update(id: string, dto: UpdateCanalesDTO, user: CurrentUser): Promise<CanalesDTO> {
    const existing = await this.repo.findById(id)
    if (!existing) throw new NotFoundError('Canales no encontrado')
    const me = await this.userRepo.findById(user.id)
    this.auth.assertOwnership(existing.hotelId, (me as any)?.hotelId ?? '', user.role, 'super_admin')
    const item = await this.repo.update(id, dto as Partial<Omit<CanalesDTO, 'id'>>)
    if (!item) throw new NotFoundError('Canales no encontrado')
    await this.cache.delete('canales:list')
    return item
  }

  async delete(id: string, user: CurrentUser): Promise<void> {
    const existing = await this.repo.findById(id)
    if (!existing) throw new NotFoundError('Canales no encontrado')
    const me = await this.userRepo.findById(user.id)
    this.auth.assertOwnership(existing.hotelId, (me as any)?.hotelId ?? '', user.role, 'super_admin')
    const deleted = await this.repo.delete(id)
    if (!deleted) throw new NotFoundError('Canales no encontrado')
    await this.cache.delete('canales:list')
  }
}
