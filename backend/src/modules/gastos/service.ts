// gastos/service.ts — Facade pública del módulo
// Responsabilidad ÚNICA: casos de uso del módulo.
// NO sabe de HTTP. NO importa de otros módulos.
// Recibe dependencias por constructor (Dependency Inversion).
//
// Si este archivo supera 200 líneas → extraer casos de uso a ./usecases/{caso}.ts
// y dejar acá solo el orquestador que delega.
//
// IMPORTANTE: depende de RepositoryAdapter<GastosDTO>, no del ORM directamente.
// Esto permite swapear SQL → MongoDB → Prisma en composition-root.ts sin tocar este archivo.

import type { RepositoryAdapter, Logger, CacheAdapter, Auth } from 'arckode-framework'
import { NotFoundError, ValidationError } from 'arckode-framework'
import type { GastosDTO, CreateGastosDTO, UpdateGastosDTO, GastosQuery, GastosPaginated, CurrentUser } from './types'
import type { GastosSockets } from './sockets'
import { auditSafely, type AuditPort } from '../../shared/usecases/audit'
import { gastosListCacheKey, invalidateGastosCaches } from './usecases/cache'

export class GastosService {
  private sockets: GastosSockets = {}
  private auditPort: AuditPort | null = null

  constructor(
    private readonly repo: RepositoryAdapter<GastosDTO>,
    private readonly userRepo: RepositoryAdapter<any>,
    private readonly logger: Logger,
    private readonly cache: CacheAdapter,
    private readonly auth: Auth,
  ) {}

  /** Conecta el audit log. Lo inyecta el connector `gastos-auditlog`. */
  setAuditDeps(port: AuditPort): void {
    this.auditPort = port
  }

  // ACUMULA handlers — nunca pisa el anterior.
  // Si dos conectores registran el mismo evento, ambos corren en cadena (secuencial).
  // Para ejecución paralela independiente → usar EventBus en composition-root.ts.
  setSockets(s: Partial<GastosSockets>): void {
    const next = s as Record<string, any>
    const cur = this.sockets as Record<string, any>
    for (const key of Object.keys(next)) {
      const h = next[key]
      if (!h) continue
      const prev = cur[key]
      cur[key] = prev ? async (...a: any[]) => { await prev(...a); await h(...a) } : h
    }
  }

  async list(query?: GastosQuery, user?: CurrentUser): Promise<GastosPaginated> {
    this.logger.info('Listando gastos', { query })

    const filters: Record<string, unknown> = {}
    if (user && user.role !== 'super_admin') {
      // hotelId llega en el JWT (HotelAuth). Sin findById: tokens legacy sin hotelId → '__none__' (lista vacía, sin fuga).
      filters.hotelId = user.hotelId ?? '__none__'
    } else if (query?.hotelId) {
      filters.hotelId = query.hotelId
    }
    if (query?.category !== undefined) filters.category = query.category

    // Paginación canónica (V-07): limita el resultset (DoS por miles de registros) y respeta page/limit.
    const page = Math.max(query?.page || 1, 1)
    const limit = Math.min(Math.max(query?.limit || 20, 1), 100)
    const offset = (page - 1) * limit

    const cacheKey = await gastosListCacheKey(this.cache, filters.hotelId as string | undefined, query)
    const cached = await this.cache.get(cacheKey)
    if (cached) return cached as GastosPaginated

    const result = await this.repo.paginate(filters, { offset, limit })
    const pages = limit > 0 ? Math.ceil(result.total / limit) : 0
    const response: GastosPaginated = {
      data: result.data,
      total: result.total,
      limit, offset, pages,
      hasNext: page < pages,
      hasPrev: page > 1,
    }
    await this.cache.set(cacheKey, response, 300)
    return response
  }

  async getById(id: string, user: CurrentUser): Promise<GastosDTO> {
    this.logger.info('Obteniendo gastos', { id })
    const item = await this.repo.findById(id)
    if (!item) throw new NotFoundError('Gastos no encontrado')
    const me = await this.userRepo.findById(user.id)
    this.auth.assertOwnership(item.hotelId, (me as any)?.hotelId ?? '', user.role, 'super_admin')
    return item
  }

  /** Gasto generado por un conector, si ya existe. Clave de deduplicación (`payroll` + runId). */
  async findBySource(hotelId: string, source: string, sourceId: string): Promise<GastosDTO | null> {
    if (!hotelId || !source || !sourceId) return null
    const rows = await this.repo.findMany({ hotelId, source, sourceId })
    return rows[0] ?? null
  }

  /** Un gasto automático no se edita ni se borra acá: su fuente de verdad es el módulo que lo creó. */
  private assertManual(item: GastosDTO): void {
    if (item.source && item.source !== 'manual') {
      throw new ValidationError(`Este gasto lo generó el módulo "${item.source}". Modificalo en su origen.`)
    }
  }

  async create(dto: CreateGastosDTO, user: CurrentUser): Promise<GastosDTO> {
    this.logger.info('Creando gastos')
    // P0 V-01 (IDOR): forzar hotelId del JWT — nunca confiar en dto.hotelId del body.
    // super_admin puede especificar hotelId; el resto siempre usa el suyo.
    const hotelId = user.role === 'super_admin' ? (dto.hotelId || user.hotelId || '') : (user.hotelId || '')
    const item = await this.repo.create({ ...dto, hotelId } as Omit<GastosDTO, 'id'>)
    await this.sockets.onGastosCreated?.(item)
    await invalidateGastosCaches(this.cache, hotelId)
    return item
  }

  /**
   * Crea un gasto automático de forma IDEMPOTENTE por (hotelId, source, sourceId). Lo usan los conectores
   * (ej. compras: 1 gasto por OC) para que un doble-click/reintento NO genere dos egresos. Fast-path por
   * `findBySource`; si la carrera crea dos, el UNIQUE INDEX en expenses(hotelId,source,sourceId) rechaza el
   * segundo y devolvemos el ganador. El módulo dueño de `expenses` es quien encapsula esta garantía.
   */
  async upsertBySource(dto: CreateGastosDTO, user: CurrentUser): Promise<GastosDTO> {
    const hotelId = user.role === 'super_admin' ? (dto.hotelId || user.hotelId || '') : (user.hotelId || '')
    if (dto.source && dto.sourceId) {
      const existing = await this.findBySource(hotelId, dto.source, dto.sourceId)
      if (existing) return existing
    }
    try {
      return await this.create(dto, user)
    } catch (e) {
      const msg = (e instanceof Error ? e.message : String(e)).toLowerCase()
      const dup = msg.includes('unique') || msg.includes('duplicate') || msg.includes('23505')
      if (dup && dto.source && dto.sourceId) {
        const won = await this.findBySource(hotelId, dto.source, dto.sourceId)
        if (won) return won
      }
      throw e
    }
  }

  async update(id: string, dto: UpdateGastosDTO, user: CurrentUser): Promise<GastosDTO> {
    this.logger.info('Actualizando gastos', { id })
    const existing = await this.repo.findById(id)
    if (!existing) throw new NotFoundError('Gastos no encontrado')
    const me = await this.userRepo.findById(user.id)
    this.auth.assertOwnership(existing.hotelId, (me as any)?.hotelId ?? '', user.role, 'super_admin')
    this.assertManual(existing)
    const item = await this.repo.update(id, dto as Partial<Omit<GastosDTO, 'id'>>)
    if (!item) throw new NotFoundError('Gastos no encontrado')
    await this.sockets.onGastosUpdated?.(item)
    await invalidateGastosCaches(this.cache, existing.hotelId)
    return item
  }

  async delete(id: string, user: CurrentUser): Promise<void> {
    this.logger.info('Eliminando gastos', { id })
    const existing = await this.repo.findById(id)
    if (!existing) throw new NotFoundError('Gastos no encontrado')
    const me = await this.userRepo.findById(user.id)
    this.auth.assertOwnership(existing.hotelId, (me as any)?.hotelId ?? '', user.role, 'super_admin')
    this.assertManual(existing)
    const deleted = await this.repo.delete(id)
    if (!deleted) throw new NotFoundError('Gastos no encontrado')
    await this.sockets.onGastosDeleted?.(id)
    await invalidateGastosCaches(this.cache, existing.hotelId)
    await auditSafely(this.auditPort, this.logger, {
      hotelId: existing.hotelId, userId: user.id, action: 'expense.delete',
      entity: 'expense', entityId: id,
      detail: `Gasto "${existing.concept}" por ${existing.amount}${existing.provider ? ` — proveedor ${existing.provider}` : ''} eliminado`,
    })
  }
}
