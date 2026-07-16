import type { RepositoryAdapter, Logger, CacheAdapter, Auth } from 'arckode-framework'
import { NotFoundError, AuthError } from 'arckode-framework'
import type { EmailQueueDTO, EmailQueueQuery, EmailQueuePaginated } from './types'
import type { EmailQueueSockets } from './sockets'

const CACHE_TTL = 30

/**
 * Capa de OPERACIÓN de la cola de emails. Lista las filas de `email_queue` (con filtro
 * por estado + paginación, aislado por hotelId) y permite REENCOLAR manualmente un email
 * fallido: lo vuelve a `pending` con attempts=0 para que el worker de EmailService lo tome
 * en el próximo tick (interval de 30s en composition-root). El envío en sí lo hace EmailService.
 */
export class EmailQueueService {
  private sockets: EmailQueueSockets = {}

  constructor(
    private readonly repo: RepositoryAdapter<EmailQueueDTO>,
    private readonly logger: Logger,
    private readonly cache: CacheAdapter,
    private readonly userRepo: RepositoryAdapter<any>,
    private readonly auth: Auth,
  ) {}

  setSockets(s: Partial<EmailQueueSockets>): void {
    const next = s as Record<string, any>
    const cur = this.sockets as Record<string, any>
    for (const key of Object.keys(next)) {
      const h = next[key]
      if (!h) continue
      const prev = cur[key]
      cur[key] = prev ? async (...a: any[]) => { await prev(...a); await h(...a) } : h
    }
  }

  /** Resuelve el hotel del usuario (del token o, si falta, de la DB). */
  private async resolveHotelId(currentUser: { id: string; role: string; hotelId?: string }): Promise<string | undefined> {
    let hotelId = currentUser.hotelId
    if (!hotelId && currentUser.role !== 'super_admin') {
      const user = await this.userRepo.findById(currentUser.id)
      hotelId = user?.hotelId
    }
    return hotelId
  }

  async list(query: EmailQueueQuery, currentUser: { id: string; role: string; hotelId?: string }): Promise<EmailQueuePaginated> {
    const filters: Record<string, unknown> = {}
    if (query.status) filters.status = query.status

    const hotelId = await this.resolveHotelId(currentUser)
    if (currentUser.role !== 'super_admin') {
      if (!hotelId) throw new AuthError('No hotel assigned')
      filters.hotelId = hotelId
    } else if (query.hotelId) {
      filters.hotelId = query.hotelId
    }

    const page = Math.max(query.page || 1, 1)
    const limit = Math.min(Math.max(query.limit || 20, 1), 100)
    const offset = (page - 1) * limit

    const result = await this.repo.paginate(filters, { offset, limit, orderBy: { field: 'updatedAt', dir: 'DESC' } })
    return { data: result.data, total: result.total, page, limit, pages: Math.ceil(result.total / limit) }
  }

  /**
   * Reencola un email para que el worker lo reintente: status→pending, attempts→0, limpia
   * error y backoff. Valida ownership por hotel. No envía en el momento; el worker lo toma en el
   * siguiente tick. Idempotente sobre filas ya `pending`.
   */
  async requeue(id: string, currentUser: { id: string; role: string; hotelId?: string }): Promise<EmailQueueDTO> {
    const existing = await this.repo.findById(id)
    if (!existing) throw new NotFoundError('Email no encontrado en la cola')
    if (currentUser.role !== 'super_admin' && existing.hotelId !== currentUser.hotelId) {
      throw new AuthError('No autorizado')
    }
    const updated = await this.repo.update(id, {
      status: 'pending',
      attempts: 0,
      lastError: null,
      nextRetryAt: null,
    } as Partial<EmailQueueDTO>)
    if (!updated) throw new NotFoundError('Email no encontrado en la cola')
    await this.cache.delete(`email-queue:list:${existing.hotelId}`)
    await this.sockets.onEmailRequeued?.(updated)
    this.logger.info('EmailQueue: reencolado manual', { id, hotelId: existing.hotelId, by: currentUser.id })
    return updated
  }
}
