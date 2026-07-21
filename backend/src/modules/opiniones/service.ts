import type { RepositoryAdapter, Logger, CacheAdapter, Auth } from 'arckode-framework'
import { NotFoundError, AuthError } from 'arckode-framework'
import type { OpinionesDTO, CreateOpinionesDTO, UpdateOpinionesDTO, OpinionesQuery, OpinionesPaginated } from './types'
import type { OpinionesSockets } from './sockets'
import { auditSafely, type AuditPort } from '../../shared/usecases/audit'

const CACHE_TTL = 300

export class OpinionesService {
  private sockets: OpinionesSockets = {}
  private auditPort: AuditPort | null = null

  /** Conecta el audit log. Lo inyecta el connector `opiniones-auditlog`. */
  setAuditDeps(port: AuditPort): void { this.auditPort = port }

  constructor(
    private readonly repo: RepositoryAdapter<OpinionesDTO>,
    private readonly logger: Logger,
    private readonly cache: CacheAdapter,
    private readonly userRepo: RepositoryAdapter<any>,
    private readonly auth: Auth,
  ) {}

  setSockets(s: Partial<OpinionesSockets>): void {
    const next = s as Record<string, any>
    const cur = this.sockets as Record<string, any>
    for (const key of Object.keys(next)) {
      const h = next[key]
      if (!h) continue
      const prev = cur[key]
      cur[key] = prev ? async (...a: any[]) => { await prev(...a); await h(...a) } : h
    }
  }

  async list(query: OpinionesQuery, currentUser: { id: string; role: string; hotelId?: string }): Promise<OpinionesPaginated> {
    const filters: Record<string, unknown> = {}
    if (query.channel) filters.channel = query.channel
    if (query.visible !== undefined) filters.visible = query.visible

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
    const limit = Math.min(Math.max(query.limit || 20, 1), 100)
    const offset = (page - 1) * limit

    // BUG FIX: la key omitía page/limit/filtros → la primera query puebla la clave y TODAS las demás
    // combinaciones (página 2, otro limit, otros filtros) recibían esa misma respuesta por CACHE_TTL.
    const filterKey = JSON.stringify(filters)
    const cacheKey = `opiniones:list:${hotelId || 'all'}:p${page}:l${limit}:${filterKey}`
    const cached = await this.cache.get(cacheKey)
    if (cached) return cached as OpinionesPaginated

    const result = await this.repo.paginate(filters, { offset, limit })
    const response = { data: result.data, total: result.total, page, limit, pages: Math.ceil(result.total / limit) }
    await this.cache.set(cacheKey, response, CACHE_TTL)
    return response
  }

  async getById(id: string, currentUser: { id: string; role: string; hotelId?: string }): Promise<OpinionesDTO> {
    const item = await this.repo.findById(id)
    if (!item) throw new NotFoundError('Opinión no encontrada')
    if (currentUser.role !== 'super_admin' && item.hotelId !== currentUser.hotelId) {
      throw new AuthError('No autorizado')
    }
    return item
  }

  async create(dto: CreateOpinionesDTO, currentUser: { id: string; role: string; hotelId?: string }): Promise<OpinionesDTO> {
    if (currentUser.role !== 'super_admin' && dto.hotelId !== currentUser.hotelId) {
      throw new AuthError('No autorizado para crear en otro hotel')
    }
    const item = await this.repo.create(dto as any)
    await this.sockets.onOpinionesCreated?.(item)
    await this.cache.delete(`opiniones:list:${dto.hotelId}`)
    return item
  }

  /**
   * Crea una invitación a opinar tras el checkout (status='pending', visible=0, rating=0).
   * La dispara el connector `reservas-opiniones` desde onReservationCheckedOut.
   * Idempotente: si ya existe una review con ese reservationId, no duplica.
   * Best-effort: nunca lanza — un fallo acá no debe romper el checkout.
   */
  async createReviewInvite(input: { hotelId: string; reservationId: string; guestId?: string | null }): Promise<OpinionesDTO | null> {
    try {
      const existing = await this.repo.findMany({ reservationId: input.reservationId } as any)
      if (existing && existing.length > 0) return existing[0]
      const today = new Date().toISOString().split('T')[0]
      const invite = await this.repo.create({
        hotelId: input.hotelId,
        guestId: input.guestId ?? undefined,
        reservationId: input.reservationId,
        rating: 0,                 // el huésped aún no respondió
        title: 'Encuesta post-estadía',
        channel: 'direct',
        visible: 0,                // oculta del listado público hasta responder
        status: 'pending',
        date: today,
      } as any)
      await this.cache.delete(`opiniones:list:${input.hotelId}`)
      this.logger.info('Invite de opinión creado', { reservationId: input.reservationId })
      return invite
    } catch (e) {
      this.logger.warn('createReviewInvite falló', { reservationId: input.reservationId, error: (e as Error).message })
      return null
    }
  }

  async update(id: string, dto: UpdateOpinionesDTO, currentUser: { id: string; role: string; hotelId?: string }): Promise<OpinionesDTO> {
    const existing = await this.repo.findById(id)
    if (!existing) throw new NotFoundError('Opinión no encontrada')
    if (currentUser.role !== 'super_admin' && existing.hotelId !== currentUser.hotelId) {
      throw new AuthError('No autorizado')
    }
    const item = await this.repo.update(id, dto as any)
    if (!item) throw new NotFoundError('Opinión no encontrada')
    await this.sockets.onOpinionesUpdated?.(item)
    await this.cache.delete(`opiniones:list:${existing.hotelId}`)
    return item
  }

  async delete(id: string, currentUser: { id: string; role: string; hotelId?: string }): Promise<void> {
    const existing = await this.repo.findById(id)
    if (!existing) throw new NotFoundError('Opinión no encontrada')
    if (currentUser.role !== 'super_admin' && existing.hotelId !== currentUser.hotelId) {
      throw new AuthError('No autorizado')
    }
    const deleted = await this.repo.delete(id)
    if (!deleted) throw new NotFoundError('Opinión no encontrada')
    await this.sockets.onOpinionesDeleted?.(id)
    await this.cache.delete(`opiniones:list:${existing.hotelId}`)
    await auditSafely(this.auditPort, this.logger, {
      hotelId: existing.hotelId, userId: currentUser.id, action: 'review.delete',
      entity: 'review', entityId: id,
      detail: `Opinión de ${existing.rating}★ eliminada${existing.title ? `: "${existing.title}"` : ''}`,
    })
  }
}
