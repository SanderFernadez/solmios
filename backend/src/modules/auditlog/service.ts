// auditlog/service.ts — Facade pública del módulo
// Append-only: create y read. Sin update ni delete.

import type { RepositoryAdapter, Logger, CacheAdapter, Auth } from 'arckode-framework'
import { NotFoundError } from 'arckode-framework'
import type { AuditlogDTO, CreateAuditlogDTO, AuditlogQuery, AuditlogPaginated } from './types'
import type { AuditlogSockets } from './sockets'

export interface AuditlogUser { id: string; hotelId?: string | null; role?: string }

const MAX_LIMIT = 100
const DEFAULT_LIMIT = 20

export class AuditlogService {
  private sockets: AuditlogSockets = {}

  constructor(
    private readonly repo: RepositoryAdapter<AuditlogDTO>,
    private readonly userRepo: RepositoryAdapter<any>,
    private readonly logger: Logger,
    private readonly cache: CacheAdapter,
    private readonly auth: Auth,
  ) {}

  setSockets(s: Partial<AuditlogSockets>): void {
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

  async list(query?: AuditlogQuery): Promise<AuditlogPaginated> {
    this.logger.info('Listando auditlog', { query })

    const page = Math.max(1, Math.floor(Number(query?.page) || 1))
    const limit = Math.min(MAX_LIMIT, Math.max(1, Math.floor(Number(query?.limit) || DEFAULT_LIMIT)))
    const offset = (page - 1) * limit
    const filters: Record<string, unknown> = {}

    if (query?.hotelId !== undefined) filters.hotelId = query.hotelId
    if (query?.status !== undefined) filters.status = query.status
    if (query?.type !== undefined) filters.type = query.type
    if (query?.category !== undefined) filters.category = query.category

    const cacheKey = `auditlog:list:${page}:${limit}:${JSON.stringify(filters)}`
    const cached = await this.cache.get<AuditlogPaginated>(cacheKey)
    if (cached) return cached

    const result = await this.repo.paginate(filters, { limit, offset })
    const paginated: AuditlogPaginated = { data: result.data, total: result.total }

    await this.cache.set(cacheKey, paginated, 60_000)
    return paginated
  }

  async getById(id: string, user: AuditlogUser): Promise<AuditlogDTO> {
    this.logger.info('Obteniendo auditlog', { id })
    const item = await this.repo.findById(id)
    if (!item) throw new NotFoundError('Auditlog no encontrado')
    // IDOR (REGLA #9): el log debe pertenecer al hotel del usuario.
    const me = await this.userRepo.findById(user.id)
    this.auth.assertOwnership((item as any).hotelId ?? '', me?.hotelId ?? '', user.role, 'super_admin')
    return item
  }

  async create(dto: CreateAuditlogDTO): Promise<AuditlogDTO> {
    this.logger.info('Creando auditlog')
    const item = await this.repo.create(dto as Omit<AuditlogDTO, 'id'>)
    await this.sockets.onAuditlogCreated?.(item)
    // Invalidar solo el listado, no todo el cache
    await this.cache.delete('auditlog:list')
    return item
  }
}
