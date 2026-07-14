import type { RepositoryAdapter, Logger, CacheAdapter, Auth } from 'arckode-framework'
import { NotFoundError, AuthError } from 'arckode-framework'
import type { TicketsDTO, CreateTicketsDTO, UpdateTicketsDTO, TicketsQuery, TicketsPaginated } from './types'
import type { TicketsSockets } from './sockets'
import { auditSafely, type AuditPort } from '../../shared/usecases/audit'

const CACHE_TTL = 300

export class TicketsService {
  private sockets: TicketsSockets = {}
  private auditPort: AuditPort | null = null

  /** Conecta el audit log. Lo inyecta el connector `tickets-auditlog`. */
  setAuditDeps(port: AuditPort): void { this.auditPort = port }

  constructor(
    private readonly repo: RepositoryAdapter<TicketsDTO>,
    private readonly logger: Logger,
    private readonly cache: CacheAdapter,
    private readonly userRepo: RepositoryAdapter<any>,
    private readonly auth: Auth,
  ) {}

  setSockets(s: Partial<TicketsSockets>): void {
    const next = s as Record<string, any>
    const cur = this.sockets as Record<string, any>
    for (const key of Object.keys(next)) {
      const h = next[key]
      if (!h) continue
      const prev = cur[key]
      cur[key] = prev ? async (...a: any[]) => { await prev(...a); await h(...a) } : h
    }
  }

  async list(query: TicketsQuery, currentUser: { id: string; role: string; hotelId?: string }): Promise<TicketsPaginated> {
    const filters: Record<string, unknown> = {}
    if (query.status) filters.status = query.status
    if (query.category) filters.category = query.category
    if (query.priority) filters.priority = query.priority
    if (query.userId) filters.userId = query.userId
    if (query.assignedTo) filters.assignedTo = query.assignedTo

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

    const cacheKey = `tickets:list:${hotelId || 'all'}`
    const cached = await this.cache.get(cacheKey)
    if (cached) return cached as TicketsPaginated

    const result = await this.repo.paginate(filters, { offset, limit })
    const response = { data: result.data, total: result.total, page, limit, pages: Math.ceil(result.total / limit) }
    await this.cache.set(cacheKey, response, CACHE_TTL)
    return response
  }

  async getById(id: string, currentUser: { id: string; role: string; hotelId?: string }): Promise<TicketsDTO> {
    const item = await this.repo.findById(id)
    if (!item) throw new NotFoundError('Ticket no encontrado')
    if (currentUser.role !== 'super_admin' && item.hotelId !== currentUser.hotelId) {
      throw new AuthError('No autorizado')
    }
    return item
  }

  async create(dto: CreateTicketsDTO, currentUser: { id: string; role: string; hotelId?: string }): Promise<TicketsDTO> {
    if (currentUser.role !== 'super_admin' && dto.hotelId !== currentUser.hotelId) {
      throw new AuthError('No autorizado para crear en otro hotel')
    }
    const item = await this.repo.create(dto as any)
    await this.sockets.onTicketsCreated?.(item)
    await this.cache.delete(`tickets:list:${dto.hotelId}`)
    return item
  }

  async update(id: string, dto: UpdateTicketsDTO, currentUser: { id: string; role: string; hotelId?: string }): Promise<TicketsDTO> {
    const existing = await this.repo.findById(id)
    if (!existing) throw new NotFoundError('Ticket no encontrado')
    if (currentUser.role !== 'super_admin' && existing.hotelId !== currentUser.hotelId) {
      throw new AuthError('No autorizado')
    }
    const item = await this.repo.update(id, dto as any)
    if (!item) throw new NotFoundError('Ticket no encontrado')
    await this.sockets.onTicketsUpdated?.(item)
    await this.cache.delete(`tickets:list:${existing.hotelId}`)
    return item
  }

  async delete(id: string, currentUser: { id: string; role: string; hotelId?: string }): Promise<void> {
    const existing = await this.repo.findById(id)
    if (!existing) throw new NotFoundError('Ticket no encontrado')
    if (currentUser.role !== 'super_admin' && existing.hotelId !== currentUser.hotelId) {
      throw new AuthError('No autorizado')
    }
    const deleted = await this.repo.delete(id)
    if (!deleted) throw new NotFoundError('Ticket no encontrado')
    await this.sockets.onTicketsDeleted?.(id)
    await this.cache.delete(`tickets:list:${existing.hotelId}`)
    await auditSafely(this.auditPort, this.logger, {
      hotelId: existing.hotelId, userId: currentUser.id, action: 'ticket.delete',
      entity: 'ticket', entityId: id, detail: `Ticket "${existing.subject}" eliminado`,
    })
  }
}
