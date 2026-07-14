import type { RepositoryAdapter, Logger, CacheAdapter, Auth } from 'arckode-framework'
import { NotFoundError, AuthError } from 'arckode-framework'
import type { ApikeysDTO, CreateApikeysDTO, UpdateApikeysDTO, ApikeysQuery, ApikeysPaginated } from './types'
import type { ApikeysSockets } from './sockets'
import { auditSafely, type AuditPort } from '../../shared/usecases/audit'
import { generateApiKey, stripSecret } from './usecases/secret'

const CACHE_TTL = 300

export class ApikeysService {
  private sockets: ApikeysSockets = {}
  private auditPort: AuditPort | null = null

  /** Conecta el audit log. Lo inyecta el connector `apikeys-auditlog`. */
  setAuditDeps(port: AuditPort): void {
    this.auditPort = port
  }

  constructor(
    private readonly repo: RepositoryAdapter<ApikeysDTO>,
    private readonly logger: Logger,
    private readonly cache: CacheAdapter,
    private readonly auth: Auth,
  ) {}

  setSockets(s: Partial<ApikeysSockets>): void {
    const next = s as Record<string, any>
    const cur = this.sockets as Record<string, any>
    for (const key of Object.keys(next)) {
      const h = next[key]
      if (!h) continue
      const prev = cur[key]
      cur[key] = prev ? async (...a: any[]) => { await prev(...a); await h(...a) } : h
    }
  }

  async list(query: ApikeysQuery, currentUser: { id: string; role: string; hotelId?: string }): Promise<ApikeysPaginated> {
    const filters: Record<string, unknown> = {}
    if (query.active !== undefined) filters.active = query.active

    if (currentUser.role !== 'super_admin') {
      if (!currentUser.hotelId) throw new AuthError('No hotel assigned')
      filters.hotelId = currentUser.hotelId
    } else if (query.hotelId) {
      filters.hotelId = query.hotelId
    }

    const page = Math.max(query.page || 1, 1)
    const limit = Math.min(Math.max(query.limit || 20, 1), 100)
    const offset = (page - 1) * limit

    // La clave incluye filtros y paginación: sin eso, distintas páginas/filtros compartían entrada.
    const cacheKey = `apikeys:list:${JSON.stringify(filters)}:${page}:${limit}`
    const cached = await this.cache.get(cacheKey)
    if (cached) return cached as ApikeysPaginated

    const result = await this.repo.paginate(filters, { offset, limit })
    // Nunca exponer el hash del secreto en un listado.
    const response = { data: result.data.map(stripSecret), total: result.total, page, limit, pages: Math.ceil(result.total / limit) }
    await this.cache.set(cacheKey, response, CACHE_TTL)
    return response
  }

  async getById(id: string, currentUser: { id: string; role: string; hotelId?: string }): Promise<ApikeysDTO> {
    const item = await this.repo.findById(id)
    if (!item) throw new NotFoundError('API Key no encontrada')
    if (currentUser.role !== 'super_admin' && item.hotelId !== currentUser.hotelId) {
      throw new AuthError('No autorizado')
    }
    return stripSecret(item)
  }

  async create(dto: CreateApikeysDTO, currentUser: { id: string; role: string; hotelId?: string }): Promise<ApikeysDTO & { plainKey: string }> {
    if (currentUser.role !== 'super_admin' && dto.hotelId !== currentUser.hotelId) {
      throw new AuthError('No autorizado para crear en otro hotel')
    }
    // El secreto lo genera el SERVIDOR: se ignora cualquier `secretHash`/`masked` que mande el
    // cliente. Se persiste solo el hash; el valor en claro (`plainKey`) se devuelve UNA vez.
    const { plainKey, secretHash, masked } = generateApiKey()
    const item = await this.repo.create({
      ...dto, secretHash, masked, active: 1, requests: 0,
    } as any)
    await this.sockets.onApikeysCreated?.(item)
    await this.cache.delete(`apikeys:list:${dto.hotelId}`)
    // plainKey solo acá: es la única vez que se ve el secreto.
    return { ...stripSecret(item), plainKey }
  }

  async update(id: string, dto: UpdateApikeysDTO, currentUser: { id: string; role: string; hotelId?: string }): Promise<ApikeysDTO> {
    const existing = await this.repo.findById(id)
    if (!existing) throw new NotFoundError('API Key no encontrada')
    if (currentUser.role !== 'super_admin' && existing.hotelId !== currentUser.hotelId) {
      throw new AuthError('No autorizado')
    }
    const item = await this.repo.update(id, dto as any)
    if (!item) throw new NotFoundError('API Key no encontrada')
    await this.sockets.onApikeysUpdated?.(item)
    await this.cache.delete(`apikeys:list:${existing.hotelId}`)
    return item
  }

  async delete(id: string, currentUser: { id: string; role: string; hotelId?: string }): Promise<void> {
    const existing = await this.repo.findById(id)
    if (!existing) throw new NotFoundError('API Key no encontrada')
    if (currentUser.role !== 'super_admin' && existing.hotelId !== currentUser.hotelId) {
      throw new AuthError('No autorizado')
    }
    const deleted = await this.repo.delete(id)
    if (!deleted) throw new NotFoundError('API Key no encontrada')
    await this.sockets.onApikeysDeleted?.(id)
    await this.cache.delete(`apikeys:list:${existing.hotelId}`)
    // SC-05: revocar una credencial deja rastro. NUNCA se loguea el secreto (secretHash/token):
    // solo el nombre y el alcance, que es lo que un auditor necesita para saber QUÉ se revocó.
    await auditSafely(this.auditPort, this.logger, {
      hotelId: existing.hotelId, userId: currentUser.id, action: 'apikey.delete',
      entity: 'apikey', entityId: id,
      detail: `API Key "${existing.name}" (scope: ${existing.scope ?? 'sin scope'}) eliminada`,
    })
  }
}
