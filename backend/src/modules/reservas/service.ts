// reservas/service.ts — Facade publica del modulo. Casos de uso, sin HTTP ni imports de otros módulos.
// Depende de RepositoryAdapter<ReservasDTO> (no del ORM directo) — swapeable en composition-root.ts.
// Si supera 200 líneas -> extraer casos de uso a ./usecases/{caso}.ts.

import type { RepositoryAdapter, Logger, CacheAdapter, Auth } from 'arckode-framework'
import { NotFoundError, AuthError } from 'arckode-framework'
import type { ReservasDTO, CreateReservasDTO, UpdateReservasDTO, ReservasQuery, ReservasPaginated } from './types'
import type { ReservasSockets } from './sockets'
import { assertRoomAvailable } from './usecases/availability'
import { NullEmailSender, type EmailSender } from '../../services/email-sender'
import { dispatchCreateEmail, dispatchCheckinEmail } from './usecases/reservation-notifications'

const CACHE_TTL = 300 // seconds
const DEFAULT_LIMIT = 20
const MAX_LIMIT = 100
const MS_PER_DAY = 86_400_000

export class ReservasService {
  private sockets: ReservasSockets = {}
  private emailSender: EmailSender = new NullEmailSender()
  private messageLogRepo: RepositoryAdapter<any> | null = null
  setEmailDeps(es: EmailSender, r: RepositoryAdapter<any>): void { this.emailSender = es; this.messageLogRepo = r }
  private notifyDeps = () => ({ emailSender: this.emailSender, messageLogRepo: this.messageLogRepo, guestRepo: this.guestRepo, roomRepo: this.roomRepo, hotelRepo: this.hotelRepo, logger: this.logger })

  constructor(
    private readonly repo: RepositoryAdapter<ReservasDTO>,
    private readonly logger: Logger,
    private readonly cache: CacheAdapter,
    private readonly userRepo: RepositoryAdapter<any>,
    private readonly auth: Auth,
    private readonly guestRepo: RepositoryAdapter<any>,
    private readonly roomRepo: RepositoryAdapter<any>,
    private readonly hotelRepo: RepositoryAdapter<any>,
  ) {}

  // ACUMULA handlers — nunca pisa el anterior.
  // Si dos conectores registran el mismo evento, ambos corren en cadena (secuencial).
  // Para ejecucion paralela independiente -> usar EventBus en composition-root.ts.
  setSockets(s: Partial<ReservasSockets>): void {
    const next = s as Record<string, any>
    const cur = this.sockets as Record<string, any>
    for (const key of Object.keys(next)) {
      const h = next[key]
      if (!h) continue
      const prev = cur[key]
      cur[key] = prev ? async (...a: any[]) => { await prev(...a); await h(...a) } : h
    }
  }

  // LIST — paginado con cache
  async list(query: ReservasQuery, currentUser: { id: string; role: string; hotelId?: string }): Promise<ReservasPaginated> {
    this.logger.info('Listando reservas', { query, userId: currentUser.id })

    const filters: Record<string, unknown> = {}
    if (query.status) filters.status = query.status
    if (query.channel) filters.channel = query.channel
    if (query.roomId) filters.roomId = query.roomId
    if (query.guestId) filters.guestId = query.guestId

    // Multi-tenancy
    // Resolve hotelId from DB if not provided in token
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
    const limit = Math.min(Math.max(query.limit || DEFAULT_LIMIT, 1), MAX_LIMIT)
    const offset = (page - 1) * limit

    // Cache key includes hotel scope + query params for correctness
    const cacheKey = `reservas:list:${hotelId || 'all'}:${JSON.stringify(filters)}:${page}:${limit}`
    const cached = await this.cache.get(cacheKey)
    if (cached) return cached as ReservasPaginated

    let result
    if (query.search) {
      // Search by guestId or externalLocator
      filters.externalLocator = { $like: `%${query.search}%` }
      result = await this.repo.paginate(filters, { offset, limit })
    } else {
      result = await this.repo.paginate(filters, { offset, limit })
    }

    const response: ReservasPaginated = {
      data: result.data,
      total: result.total,
      page,
      limit,
      pages: Math.ceil(result.total / limit),
    }
    await this.cache.set(cacheKey, response, CACHE_TTL)
    return response
  }

  // GET BY ID — ownership check
  async getById(id: string, currentUser: { id: string; role: string; hotelId?: string }): Promise<ReservasDTO> {
    this.logger.info('Obteniendo reserva', { id, userId: currentUser.id })

    const item = await this.repo.findById(id)
    if (!item) throw new NotFoundError('Reserva no encontrada')

    // Multi-tenancy: super_admin sees all, others only their hotel
    if (currentUser.role !== 'super_admin' && item.hotelId !== currentUser.hotelId) {
      throw new AuthError('No autorizado')
    }
    return item
  }

  // CREATE — date validation + availability + ownership
  async create(dto: CreateReservasDTO, currentUser: { id: string; role: string; hotelId?: string }): Promise<ReservasDTO> {
    this.logger.info('Creando reserva', { userId: currentUser.id, roomId: dto.roomId })

    // Multi-tenancy: cannot create in another hotel
    if (currentUser.role !== 'super_admin' && dto.hotelId !== currentUser.hotelId) {
      throw new AuthError('No autorizado para crear en otro hotel')
    }

    // Date validation: checkIn must be before checkOut
    if (dto.checkIn >= dto.checkOut) {
      throw new AuthError('checkIn debe ser anterior a checkOut')
    }

    // Availability check — no overlap with active reservations
    await assertRoomAvailable(this.repo, dto.roomId, dto.checkIn, dto.checkOut)

    const item = await this.repo.create(dto as any)
    await this.sockets.onReservasCreated?.(item)
    await this.cache.delete(`reservas:list:${dto.hotelId}`)

    // ── Encolar email según communicateClient (spec 6.1.4) ──
    dispatchCreateEmail(this.notifyDeps(), dto, item)

    return item
  }

  // UPDATE — ownership + date validation + availability
  async update(id: string, dto: UpdateReservasDTO, currentUser: { id: string; role: string; hotelId?: string }): Promise<ReservasDTO> {
    this.logger.info('Actualizando reserva', { id, userId: currentUser.id })

    const existing = await this.repo.findById(id)
    if (!existing) throw new NotFoundError('Reserva no encontrada')

    // Multi-tenancy
    if (currentUser.role !== 'super_admin' && existing.hotelId !== currentUser.hotelId) {
      throw new AuthError('No autorizado')
    }

    // Date validation if changing dates
    const newCheckIn = dto.checkIn || existing.checkIn
    const newCheckOut = dto.checkOut || existing.checkOut
    if (newCheckIn >= newCheckOut) {
      throw new AuthError('checkIn debe ser anterior a checkOut')
    }

    // Availability check if changing room or dates
    if (dto.roomId || dto.checkIn || dto.checkOut) {
      await assertRoomAvailable(this.repo, dto.roomId || existing.roomId, newCheckIn, newCheckOut, id)
    }

    const item = await this.repo.update(id, dto as any)
    if (!item) throw new NotFoundError('Reserva no encontrada')

    await this.sockets.onReservasUpdated?.(item)
    await this.cache.delete(`reservas:list:${existing.hotelId}`)

    // ── Email de bienvenida al hacer check-in (spec 11.1.1, dual path) ──
    dispatchCheckinEmail(this.notifyDeps(), existing, dto, item)

    return item
  }

  // DELETE — ownership check
  async delete(id: string, currentUser: { id: string; role: string; hotelId?: string }): Promise<void> {
    this.logger.info('Eliminando reserva', { id, userId: currentUser.id })

    const existing = await this.repo.findById(id)
    if (!existing) throw new NotFoundError('Reserva no encontrada')

    // Multi-tenancy
    if (currentUser.role !== 'super_admin' && existing.hotelId !== currentUser.hotelId) {
      throw new AuthError('No autorizado')
    }

    const deleted = await this.repo.delete(id)
    if (!deleted) throw new NotFoundError('Reserva no encontrada')

    await this.sockets.onReservasDeleted?.(id)
    await this.cache.delete(`reservas:list:${existing.hotelId}`)
  }
}
