// canales/service.ts — Facade pública del módulo (orquestador)
// Delega las operaciones de Channex a usecases/channex.ts (client API).
// Aquí vive solo: config por hotel + CRUD sobre la config + orquestación.
// NO sabe de HTTP. NO importa de otros módulos. Recibe dependencias por constructor.

import type { RepositoryAdapter, Logger, CacheAdapter, ORM } from 'arckode-framework'
import { NotFoundError } from 'arckode-framework'
import type {
  CanalesDTO, CreateCanalesDTO, UpdateCanalesDTO, CanalesQuery, CanalesPaginated,
  ChannelsResultDTO, RoomTypeSummary, SyncResultDTO,
  TestConnectionResultDTO, MappingDetailDTO, GroupDTO, OTAChannelCreateDTO, OTAChannelResultDTO,
  OTAChannelMeta, BookingRevisionDTO, BookingIngestionResult,
} from './types'
import type { CanalesSockets } from './sockets'
import { ChannexUseCase } from './usecases/channex'

export class CanalesService {
  private sockets: CanalesSockets = {}
  private readonly channex: ChannexUseCase

  constructor(
    private readonly repo: RepositoryAdapter<CanalesDTO>,
    private readonly logger: Logger,
    private readonly cache: CacheAdapter,
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

  async syncProperty(hotelId: string, hotel: { nombre: string; moneda?: string; email?: string; direccion?: string; zonaHoraria?: string }, rooms: RoomTypeSummary[]): Promise<SyncResultDTO> {
    const cfg = await this.getConfig(hotelId)
    const { result, newPropertyId } = await this.channex.syncProperty(hotel, rooms, cfg)
    if (newPropertyId) await this.upsertConfig(hotelId, { channexPropertyId: newPropertyId, syncEnabled: 1, ultimaSync: new Date().toISOString() })
    else await this.upsertConfig(hotelId, { ultimaSync: new Date().toISOString() })
    return result
  }

  async pushRate(hotelId: string, roomType: string, precioBase: number): Promise<{ pushed: boolean }> {
    return this.channex.pushRate(await this.getConfig(hotelId), roomType, precioBase)
  }

  // ─── Channel API ─────────────────────────────────────────────────────
  async testConnection(hotelId: string, channel: string, otaHotelId: string): Promise<TestConnectionResultDTO> {
    const cfg = await this.getConfig(hotelId)
    return this.channex.testConnection(cfg, { channel, hotel_id: otaHotelId })
  }

  async getMappingDetails(hotelId: string, channel: string, otaHotelId: string): Promise<{ success: boolean; rooms: MappingDetailDTO[]; error?: string }> {
    const cfg = await this.getConfig(hotelId)
    return this.channex.getMappingDetails(cfg, channel, otaHotelId)
  }

  async listGroups(hotelId: string): Promise<GroupDTO[]> {
    const cfg = await this.getConfig(hotelId)
    return this.channex.listGroups(cfg)
  }

  async createOTAChannel(hotelId: string, dto: OTAChannelCreateDTO): Promise<OTAChannelResultDTO> {
    const cfg = await this.getConfig(hotelId)
    return this.channex.createOTAChannel(cfg, dto)
  }

  async deactivateChannel(hotelId: string, channelId: string): Promise<{ success: boolean; message: string }> {
    const cfg = await this.getConfig(hotelId)
    return this.channex.deactivateChannel(cfg, channelId)
  }

  // ─── Bookings ──────────────────────────────────────────────────────
  async getBookings(hotelId: string): Promise<BookingRevisionDTO[]> {
    const cfg = await this.getConfig(hotelId)
    return this.channex.fetchBookingFeed(cfg?.channexApiKey || process.env.CHANNEX_API_KEY || '')
  }

  async ingestBookings(hotelId: string): Promise<BookingIngestionResult> {
    const cfg = await this.getConfig(hotelId)
    return this.channex.ingestBookings(cfg, async (dto: any) => {
      if (!this.orm) throw new Error('ORM no disponible')
      // Dedupe: si ya existe una reserva con el mismo otaReservationCode, no duplicar.
      if (dto.otaReservationCode) {
        const existing = await this.orm.findMany('Reservations', { hotelId, otaReservationCode: dto.otaReservationCode })
        if (existing && existing.length > 0) return
      }
      dto.id = crypto.randomUUID()
      await this.orm.create('Reservations', dto)
    })
  }

  // ─── iFrame ────────────────────────────────────────────────────────
  async getIframeToken(hotelId: string, username: string): Promise<string | null> {
    const cfg = await this.getConfig(hotelId)
    return this.channex.generateIframeToken(cfg, username)
  }

  /** Devuelve el channexPropertyId configurado para el hotel (null si no sincronizó). */
  async getPropertyId(hotelId: string): Promise<string | null> {
    const cfg = await this.getConfig(hotelId)
    return cfg?.channexPropertyId || null
  }

  async getChannelDetail(hotelId: string, channelId: string): Promise<any | null> {
    const cfg = await this.getConfig(hotelId)
    return this.channex.getChannelDetail(cfg, channelId)
  }

  // ─── CRUD estándar sobre la config (admin) ───────────────────────────
  async list(query?: CanalesQuery): Promise<CanalesPaginated> {
    const page = query?.page ?? 1
    const limit = query?.limit ?? 20
    const offset = (page - 1) * limit
    const filters: Record<string, unknown> = {}
    if (query?.hotelId !== undefined) filters.hotelId = query.hotelId
    const result = await this.repo.paginate(filters, { limit, offset })
    return { data: result.data, pagination: { page, limit, total: result.total, totalPages: result.pages, hasNext: offset + limit < result.total, hasPrev: page > 1 } }
  }

  async getById(id: string): Promise<CanalesDTO> {
    // @ignore IDOR_RISK — config del channel manager admin-only (rutas con super_admin); lookup por id de config no expone datos de otro usuario.
    const item = await this.repo.findById(id)
    if (!item) throw new NotFoundError('Canales no encontrado')
    return item
  }

  async create(dto: CreateCanalesDTO): Promise<CanalesDTO> {
    const item = await this.repo.create(dto as Omit<CanalesDTO, 'id'>)
    await this.cache.delete('canales:list')
    return item
  }

  async update(id: string, dto: UpdateCanalesDTO): Promise<CanalesDTO> {
    const item = await this.repo.update(id, dto as Partial<Omit<CanalesDTO, 'id'>>)
    if (!item) throw new NotFoundError('Canales no encontrado')
    await this.cache.delete('canales:list')
    return item
  }

  async delete(id: string): Promise<void> {
    const deleted = await this.repo.delete(id)
    if (!deleted) throw new NotFoundError('Canales no encontrado')
    await this.cache.delete('canales:list')
  }
}
