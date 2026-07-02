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
import { CanalesCrudUseCase } from './usecases/crud'
import { ChannelApiUseCase } from './usecases/channel-api'
import { BookingsUseCase } from './usecases/bookings'
import { ConfigUseCase } from './usecases/config'

export class CanalesService {
  private sockets: CanalesSockets = {}
  private readonly channex: ChannexUseCase
  private readonly crud: CanalesCrudUseCase
  private readonly channelApi: ChannelApiUseCase
  private readonly bookings: BookingsUseCase
  private readonly config: ConfigUseCase

  constructor(
    private readonly repo: RepositoryAdapter<CanalesDTO>,
    private readonly userRepo: RepositoryAdapter<any>,
    private readonly logger: Logger,
    private readonly cache: CacheAdapter,
    private readonly auth: Auth,
    private readonly orm?: ORM,
    private readonly syncLogRepo?: RepositoryAdapter<any>,
  ) {
    this.channex = new ChannexUseCase(logger)
    this.crud = new CanalesCrudUseCase(repo, userRepo, auth)
    this.channelApi = new ChannelApiUseCase(this.channex)
    this.bookings = new BookingsUseCase(this.channex, orm!)
    this.config = new ConfigUseCase(repo, orm)
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

  // ─── Config delegado a usecase ───────────────────────────────────────
  async getConfig(hotelId: string): Promise<CanalesDTO | undefined> {
    return this.config.getConfig(hotelId)
  }

  private async upsertConfig(hotelId: string, patch: Partial<CanalesDTO>): Promise<CanalesDTO> {
    return this.config.upsertConfig(hotelId, patch)
  }

  // ─── Operaciones Channex (delegan al usecase) ────────────────────────
  async listChannels(hotelId: string): Promise<ChannelsResultDTO> {
    const catalog = await this.config.getOTACatalog()
    return this.channex.listChannels(await this.getConfig(hotelId), catalog)
  }

  async getFeed(): Promise<{ pendingBookings: number }> {
    return this.channex.getFeed()
  }

  async syncProperty(hotelId: string, hotel: { name: string; currency?: string; email?: string; address?: string; timezone?: string }, rooms: RoomTypeSummary[]): Promise<SyncResultDTO> {
    const cfg = await this.getConfig(hotelId)
    const { result, newPropertyId } = await this.channex.syncProperty(hotel, rooms, cfg)
    if (newPropertyId) await this.upsertConfig(hotelId, { channexPropertyId: newPropertyId, syncEnabled: 1, lastSync: new Date().toISOString() })
    else await this.upsertConfig(hotelId, { lastSync: new Date().toISOString() })

    // Log sync operation to DB
    if (this.syncLogRepo) {
      try {
        await this.syncLogRepo.create({
          id: crypto.randomUUID(), hotelId, channel: 'channex', action: 'sync_property',
          status: result.success ? 'success' : 'error',
          details: { roomTypes: result.roomTypes, ratePlans: result.ratePlans, newPropertyId },
          createdAt: new Date().toISOString(),
        })
      } catch {}
    }

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

  // ─── Channel API delegado a usecase ──────────────────────────────────
  async testConnection(hotelId: string, channel: string, otaHotelId: string): Promise<TestConnectionResultDTO> {
    return this.channelApi.testConnection(await this.getConfig(hotelId), channel, otaHotelId)
  }
  async getMappingDetails(hotelId: string, channel: string, otaHotelId: string): Promise<{ success: boolean; rooms: MappingDetailDTO[]; error?: string }> {
    return this.channelApi.getMappingDetails(await this.getConfig(hotelId), channel, otaHotelId)
  }
  async listGroups(hotelId: string): Promise<GroupDTO[]> {
    return this.channelApi.listGroups(await this.getConfig(hotelId))
  }
  async createOTAChannel(hotelId: string, dto: OTAChannelCreateDTO): Promise<OTAChannelResultDTO> {
    return this.channelApi.createOTAChannel(await this.getConfig(hotelId), dto)
  }
  async deactivateChannel(hotelId: string, channelId: string): Promise<{ success: boolean; message: string }> {
    return this.channelApi.deactivateChannel(await this.getConfig(hotelId), channelId)
  }

  // ─── Bookings delegado a usecase ─────────────────────────────────────
  async getBookings(hotelId: string): Promise<BookingRevisionDTO[]> {
    return this.bookings.getBookings(await this.getConfig(hotelId))
  }
  async ingestBookings(hotelId: string): Promise<BookingIngestionResult> {
    const cfg = await this.getConfig(hotelId)
    const result = await this.bookings.ingestBookings(hotelId, cfg)

    // Log ingest operation
    if (this.syncLogRepo) {
      try {
        await this.syncLogRepo.create({
          id: crypto.randomUUID(), hotelId, channel: 'channex', action: 'ingest_bookings',
          status: result.success ? 'success' : 'error',
          details: { ingested: result.ingested, acknowledged: result.acknowledged, errors: result.errors },
          createdAt: new Date().toISOString(),
        })
      } catch {}
    }

    return result
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
    return this.channelApi.getChannelDetail(await this.getConfig(hotelId), channelId)
  }

  // ─── CRUD delegado a usecase ─────────────────────────────────────────
  async list(query?: CanalesQuery, user?: CurrentUser): Promise<CanalesPaginated> {
    return this.crud.list(query, user as any)
  }

  async getById(id: string, user: CurrentUser): Promise<CanalesDTO> {
    return this.crud.getById(id, user as any)
  }

  async create(dto: CreateCanalesDTO): Promise<CanalesDTO> {
    const item = await this.crud.create(dto)
    await this.cache.delete('canales:list')
    return item
  }

  async update(id: string, dto: UpdateCanalesDTO, user: CurrentUser): Promise<CanalesDTO> {
    const item = await this.crud.update(id, dto, user as any)
    await this.cache.delete('canales:list')
    return item
  }

  async delete(id: string, user: CurrentUser): Promise<void> {
    await this.crud.delete(id, user as any)
    await this.cache.delete('canales:list')
  }
}
