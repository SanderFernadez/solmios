// external-reviews/service.ts — Facade del módulo (F3, spec reputation-aggregator).
//
// Responsabilidades:
//  - CRUD admin con ownership IDOR (auth.assertOwnership post-findOne).
//  - `upsertBatch(hotelId, reviews)`: ingesta batch del cron — DELEGA a usecases/upsert-batch.ts
//    (extraído para evitar God Object >200 líneas, convención del proyecto).
//
// NO sabe de HTTP. NO importa de otros módulos. Recibe dependencias por constructor
// (Dependency Inversion): `RepositoryAdapter<ExternalReviewDTO>`, no el ORM directo.
//
// Anti-patrón ORM (mem 1805): TODO campo persistido por el service/DTO/validator está
// declarado en `model.ts` (case-sensitive). `source` y `sourceExternalId` son inmutables
// post-create (forman el UNIQUE de dedup) → NO se updatean, viven solo en CreateDTO.
//
// Unique (source, sourceExternalId): el service captura la violación del UNIQUE index físico
// (`external_reviews_source_extid`, migrate-db.ts) y la traduce a ConflictError en vez de
// dejar pasar el error crudo del motor (SQLite/PG mensajes distintos). Mismo patrón que
// promo-codes.isDuplicateError / folio-entries.isDuplicateError.
import type { RepositoryAdapter, Logger, CacheAdapter, Auth } from 'arckode-framework'
import { NotFoundError, ValidationError, ConflictError } from 'arckode-framework'
import type {
  ExternalReviewDTO, CreateExternalReviewDTO, UpdateExternalReviewDTO,
  ExternalReviewsQuery, ExternalReviewsPaginated, UpsertBatchResult,
  ExternalReviewSource, NormalizedExternalReview, CurrentUser,
} from './types'
import type { ExternalReviewsSockets } from './sockets'
import { upsertBatch as upsertBatchUsecase, isDuplicateError } from './usecases/upsert-batch'

const SOURCES: ReadonlySet<ExternalReviewSource> = new Set([
  'google', 'tripadvisor', 'booking', 'airbnb', 'expedia',
])
const RATING_MIN = 1
const RATING_MAX = 5
const DEFAULT_PAGE = 1
const DEFAULT_LIMIT = 20
const MAX_LIMIT = 100

/** Valida que `s` esté en el enum cerrado de fuentes. */
function assertSource(s: unknown): ExternalReviewSource {
  if (typeof s !== 'string' || !SOURCES.has(s as ExternalReviewSource)) {
    throw new ValidationError(
      "source debe ser 'google' | 'tripadvisor' | 'booking' | 'airbnb' | 'expedia'",
    )
  }
  return s as ExternalReviewSource
}

/** Valida rating en [1,5] (admite decimales tipo 4.5). */
function assertRating(r: unknown): number {
  const n = Number(r)
  if (!Number.isFinite(n) || n < RATING_MIN || n > RATING_MAX) {
    throw new ValidationError(`rating debe estar en [${RATING_MIN}, ${RATING_MAX}]`)
  }
  return n
}

export interface ExternalReviewsServiceDeps {
  auth: Auth
}

export class ExternalReviewsService {
  private sockets: ExternalReviewsSockets = {}

  constructor(
    private readonly repo: RepositoryAdapter<ExternalReviewDTO>,
    private readonly logger: Logger,
    private readonly cache: CacheAdapter,
    private readonly deps: ExternalReviewsServiceDeps,
  ) {}

  /** Conecta sockets (lo inyecta el connector que orqueste eventos, si lo hubiera). */
  setSockets(_s: Partial<ExternalReviewsSockets>): void {
    // Por ahora no hay sockets definidos (ver sockets.ts). Skeleton para F3.4/F3.5.
  }

  // ─── Admin CRUD ──────────────────────────────────────────────────────────

  /** Lista paginado, filtrado por hotelId del JWT (multi-tenant estricto). */
  async list(query: ExternalReviewsQuery, user: CurrentUser): Promise<ExternalReviewsPaginated> {
    const hotelId = user.role === 'super_admin' ? (query.hotelId ?? user.hotelId ?? '') : (user.hotelId ?? '')
    if (!hotelId) throw new ValidationError('Sin hotel asignado')

    const filters: Record<string, unknown> = { hotelId }
    if (query.source) filters.source = assertSource(query.source)

    const page = Math.max(query.page ?? DEFAULT_PAGE, 1)
    const limit = Math.min(Math.max(query.limit ?? DEFAULT_LIMIT, 1), MAX_LIMIT)
    const offset = (page - 1) * limit

    const result = await this.repo.paginate(filters, { offset, limit })
    return {
      data: result.data,
      total: result.total,
      page, limit,
      pages: Math.max(Math.ceil(result.total / limit), 0),
    }
  }

  /** Devuelve una review por id, validando ownership del hotel. */
  async getById(id: string, user: CurrentUser): Promise<ExternalReviewDTO> {
    const item = await this.repo.findById(id)
    if (!item) throw new NotFoundError('Reseña externa no encontrada')
    this.deps.auth.assertOwnership(item.hotelId, user.hotelId ?? '', user.role, 'super_admin')
    return item
  }

  /** Crea una review manualmente (admin). Valida source y rating. */
  async create(dto: CreateExternalReviewDTO, user: CurrentUser): Promise<ExternalReviewDTO> {
    assertSource(dto.source)
    assertRating(dto.rating)
    this.deps.auth.assertOwnership(dto.hotelId, user.hotelId ?? '', user.role, 'super_admin')
    try {
      return await this.repo.create(dto as Omit<ExternalReviewDTO, 'id'>)
    } catch (e: unknown) {
      if (isDuplicateError(e)) {
        throw new ConflictError('Ya existe una review con ese (source, sourceExternalId)')
      }
      throw e
    }
  }

  /** Actualiza campos mutables (source/sourceExternalId intocables). */
  async update(id: string, dto: UpdateExternalReviewDTO, user: CurrentUser): Promise<ExternalReviewDTO> {
    const existing = await this.repo.findById(id)
    if (!existing) throw new NotFoundError('Reseña externa no encontrada')
    this.deps.auth.assertOwnership(existing.hotelId, user.hotelId ?? '', user.role, 'super_admin')
    if (dto.rating !== undefined) assertRating(dto.rating)
    const item = await this.repo.update(id, dto as Partial<Omit<ExternalReviewDTO, 'id'>>)
    if (!item) throw new NotFoundError('Reseña externa no encontrada')
    return item
  }

  /** Borra una review (admin). */
  async delete(id: string, user: CurrentUser): Promise<void> {
    const existing = await this.repo.findById(id)
    if (!existing) throw new NotFoundError('Reseña externa no encontrada')
    this.deps.auth.assertOwnership(existing.hotelId, user.hotelId ?? '', user.role, 'super_admin')
    const deleted = await this.repo.delete(id)
    if (!deleted) throw new NotFoundError('Reseña externa no encontrada')
  }

  // ─── Ingesta batch del cron (público al módulo, no a la API HTTP) ─────────

  /**
   * Upsert batch con dedup por `(source, sourceExternalId)`. Delega al usecase homónimo
   * (ver usecases/upsert-batch.ts para el detalle de la estrategia). Punto de entrada
   * del cron: `system.resolveModule('external-reviews').upsertBatch(hotelId, reviews)`.
   */
  async upsertBatch(hotelId: string, incoming: NormalizedExternalReview[]): Promise<UpsertBatchResult> {
    const result = await upsertBatchUsecase({ repo: this.repo }, hotelId, incoming)
    this.logger.info('external-reviews upsert batch', { hotelId, ...result, totalIncoming: incoming.length })
    return result
  }
}
