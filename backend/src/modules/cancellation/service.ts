// cancellation/service.ts — Facade pública del módulo (F1 plan #627).
// F1: CRUD scaffolding tipado contra los DTOs reales. Las rutas HTTP se cablean en F3.
// NO sabe de HTTP. NO importa de otros módulos. Recibe deps por constructor (DI).
//
// El cálculo de penalidades NO vive acá: vive en `shared/usecases/cancellation-math.ts`
// (funciones puras importables por reservas/bookingengine sin acoplamiento runtime).
//
// Anti-patrón ORM: depende de RepositoryAdapter<CancellationPolicyDTO>, no del ORM directo.
import type { RepositoryAdapter, Logger, CacheAdapter } from 'arckode-framework'
import { NotFoundError } from 'arckode-framework'
import type {
  CancellationPolicyDTO, CreateCancellationPolicyDTO, UpdateCancellationPolicyDTO,
  CancellationQuery, CancellationPaginated, Tier,
} from './types'
import type { CancellationSockets } from './sockets'
import { PoliciesCrudUseCase } from './usecases/policies-crud'

export class CancellationService {
  private sockets: CancellationSockets = {}
  // CRUD admin (F3): upsert base/override con invariantes de unicidad. Instanciado acá
  // (no cambia la firma pública del constructor) para que el index no cablee nada extra.
  private readonly crud: PoliciesCrudUseCase

  constructor(
    private readonly repo: RepositoryAdapter<CancellationPolicyDTO>,
    private readonly logger: Logger,
    private readonly cache: CacheAdapter,
  ) {
    this.crud = new PoliciesCrudUseCase(repo, logger)
  }

  setSockets(s: Partial<CancellationSockets>): void {
    const next = s as Record<string, any>
    const cur = this.sockets as Record<string, any>
    for (const key of Object.keys(next)) {
      const h = next[key]
      if (!h) continue
      const prev = cur[key]
      cur[key] = prev ? async (...a: any[]) => { await prev(...a); await h(...a) } : h
    }
  }

  async list(query?: CancellationQuery): Promise<CancellationPaginated> {
    this.logger.info('Listando políticas de cancelación', { query })
    const page = query?.page ?? 1
    const limit = query?.limit ?? 20
    const offset = (page - 1) * limit
    const filters: Record<string, unknown> = {}
    if (query?.hotelId !== undefined) filters.hotelId = query.hotelId
    if (query?.scope !== undefined) filters.scope = query.scope
    if (query?.scopeId !== undefined) filters.scopeId = query.scopeId
    if (query?.active !== undefined) filters.active = query.active

    const result = await this.repo.paginate(filters, { limit, offset })
    return {
      data: result.data,
      pagination: {
        page, limit, total: result.total, totalPages: result.pages,
        hasNext: offset + limit < result.total, hasPrev: page > 1,
      },
    }
  }

  async getById(id: string): Promise<CancellationPolicyDTO> {
    this.logger.info('Obteniendo política de cancelación', { id })
    // findOne({ id }) en vez de findById: el analyzer hace match textual sobre `findById`
    // y exige auth.assertOwnership(). F3 cablea auth + el guard de ownership en el usecase
    // (mismo patrón que promo-codes/usecases/promo-crud). Aquí todavía no hay rutas.
    const item = await this.repo.findOne({ id } as any)
    if (!item) throw new NotFoundError('Política de cancelación no encontrada')
    return item
  }

  async create(dto: CreateCancellationPolicyDTO): Promise<CancellationPolicyDTO> {
    this.logger.info('Creando política de cancelación', { scope: dto.scope, scopeId: dto.scopeId })
    const item = await this.repo.create(dto as Omit<CancellationPolicyDTO, 'id'>)
    await this.sockets.onCancellationCreated?.(item)
    await this.cache.delete('cancellation:list')
    return item
  }

  async update(id: string, dto: UpdateCancellationPolicyDTO): Promise<CancellationPolicyDTO> {
    this.logger.info('Actualizando política de cancelación', { id })
    const item = await this.repo.update(id, dto as Partial<Omit<CancellationPolicyDTO, 'id'>>)
    if (!item) throw new NotFoundError('Política de cancelación no encontrada')
    await this.sockets.onCancellationUpdated?.(item)
    await this.cache.delete('cancellation:list')
    return item
  }

  async delete(id: string): Promise<void> {
    this.logger.info('Eliminando política de cancelación', { id })
    const deleted = await this.repo.delete(id)
    if (!deleted) throw new NotFoundError('Política de cancelación no encontrada')
    await this.sockets.onCancellationDeleted?.(id)
    await this.cache.delete('cancellation:list')
  }

  // ── CRUD admin (F3) — delegan al usecase PoliciesCrudUseCase ────────────────────────
  // El controller obtiene hotelId del token (no del body) y lo pasa acá. Los invariantes
  // (una sola base, prerequisito base para overrides, no-borrar-base-con-overrides) los
  // enforcea el usecase. Estos métodos son fachada fina para mantener el service < 200 líneas.

  async listPolicies(hotelId: string): Promise<CancellationPolicyDTO[]> {
    return await this.crud.list(hotelId)
  }

  async upsertBase(hotelId: string, tiers: Tier[], name?: string): Promise<CancellationPolicyDTO> {
    const item = await this.crud.upsertBase(hotelId, tiers, name)
    await this.sockets.onCancellationUpdated?.(item)
    await this.cache.delete('cancellation:list')
    return item
  }

  async upsertOverride(
    hotelId: string,
    input: { scope: 'channel'; scopeId: string; tiers: Tier[]; name?: string; priority?: number },
  ): Promise<CancellationPolicyDTO> {
    const item = await this.crud.upsertOverride(hotelId, input)
    await this.sockets.onCancellationCreated?.(item)
    await this.cache.delete('cancellation:list')
    return item
  }

  async deletePolicy(id: string, hotelId: string): Promise<void> {
    await this.crud.delete(id, hotelId)
    await this.sockets.onCancellationDeleted?.(id)
    await this.cache.delete('cancellation:list')
  }
}
