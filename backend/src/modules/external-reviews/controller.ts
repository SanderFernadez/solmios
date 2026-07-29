// external-reviews/controller.ts — Adaptador HTTP del módulo (F3, spec reputation-aggregator).
// Responsabilidad ÚNICA: traducir request → service → response.
// SIN lógica de negocio. SIN llamadas directas al ORM. (REGLA #12)
// Toda mutación (POST/PUT/PATCH) DEBE pasar por validateSchema(). (REGLA #11)
//
// Rutas (registradas en index.ts, todas admin con auth + permiso billing:*):
//   GET    /api/external-reviews              → list (paginado, multi-tenant)
//   GET    /api/external-reviews/:id          → get by id
//   POST   /api/external-reviews              → create manual
//   PUT    /api/external-reviews/:id          → update (campos mutables)
//   DELETE /api/external-reviews/:id          → delete
//   POST   /api/external-reviews/sync-now     → F3 3.5 dispara pull manual (settings:edit)
//
// El endpoint público vive en opiniones (F0 0.11 GET /api/public/hotels/:slug/reviews) —
// F3 task 3.4 lo extiende para incluir external_reviews en el aggregate + listado.
import type { HttpRequest, Logger } from 'arckode-framework'
import { validateSchema } from 'arckode-framework'
import { AuthError } from 'arckode-framework'
import type { ExternalReviewsService } from './service'
import { CreateExternalReviewSchema, UpdateExternalReviewSchema } from './validators/schema'
import type { CurrentUser, ExternalReviewsQuery, ExternalReviewSource } from './types'
import { syncHotelReviews, type ExternalReviewsFetchers } from '../../shared/usecases/external-reviews-cron'

/** Deps para `syncNow` — inyectadas por el módulo desde composition-root (orm + cache viven
 *  en el scope del create(), fetchers vienen por opts). `resolveModule` es un closure que
 *  devuelve el service del módulo propio (no pasa por system.resolveModule para evitar
 *  acoplar el controller al sistema). */
export interface SyncNowDeps {
  orm: any
  resolveModule: (name: string) => any
  /** Si no viene (tests / entorno sin fetchers wireados), el endpoint responde 503. */
  fetchers?: ExternalReviewsFetchers
  cache: { delete: (key: string) => Promise<unknown> }
}

export class ExternalReviewsController {
  constructor(
    private readonly service: ExternalReviewsService,
    private readonly logger: Logger,
  ) {}

  /** Extrae el usuario actual del request. Si no hay sesión → 401. */
  private user(req: HttpRequest): CurrentUser {
    const u = (req as any).user
    if (!u) throw new AuthError('No autenticado')
    return { id: u.id, role: u.role, hotelId: u.hotelId }
  }

  async index(req: HttpRequest) {
    const user = this.user(req)
    const q = req.query as ExternalReviewsQuery
    this.logger.info('GET /api/external-reviews', { hotelId: user.hotelId, source: q.source })
    const result = await this.service.list(q, user)
    return { status: 200, body: result }
  }

  async show(req: HttpRequest) {
    const user = this.user(req)
    this.logger.info('GET /api/external-reviews/:id', { id: req.params.id })
    const item = await this.service.getById(req.params.id, user)
    return { status: 200, body: item }
  }

  async store(req: HttpRequest) {
    const user = this.user(req)
    this.logger.info('POST /api/external-reviews', { hotelId: user.hotelId })
    const data = validateSchema(CreateExternalReviewSchema, req.body)
    const item = await this.service.create(data as any, user)
    return { status: 201, body: item }
  }

  async update(req: HttpRequest) {
    const user = this.user(req)
    this.logger.info('PUT /api/external-reviews/:id', { id: req.params.id })
    const data = validateSchema(UpdateExternalReviewSchema, req.body)
    const item = await this.service.update(req.params.id, data as any, user)
    return { status: 200, body: item }
  }

  async destroy(req: HttpRequest) {
    const user = this.user(req)
    this.logger.info('DELETE /api/external-reviews/:id', { id: req.params.id })
    await this.service.delete(req.params.id, user)
    return { status: 204, body: null }
  }

  /**
   * F3 3.5 — POST /api/external-reviews/sync-now
   * Dispara el pull manualmente para el hotel del JWT. Devuelve count de reviews nuevas
   * y actualizadas. El cron nightly hace lo mismo a 00:00 UTC; este endpoint es para
   * validar creds tras guardarlas ("Sync now" en el panel admin).
   *
   * Spec.md:64-71 idempotente: si las reviews ya están, inserted=0, updated=0.
   * Si el hotel no tiene creds → 200 con `{ noCreds: true }` (no es error, es "nada que sync").
   * Si los fetchers no están inyectados (tests/sin environment) → 503.
   */
  async syncNow(req: HttpRequest, deps: SyncNowDeps) {
    const user = this.user(req)
    if (!user.hotelId) {
      return { status: 400, body: { error: 'Sin hotel asignado' } }
    }
    if (!deps.fetchers) {
      return { status: 503, body: { error: 'Sync no disponible en este entorno' } }
    }
    this.logger.info('POST /api/external-reviews/sync-now', { hotelId: user.hotelId })
    const result = await syncHotelReviews(
      user.hotelId,
      deps.orm,
      deps.resolveModule,
      this.logger,
      deps.fetchers,
      deps.cache,
    )
    return { status: 200, body: { hotelId: user.hotelId, ...result } }
  }
}

/** Helper para evitar `as any` en los guards — exporta tipo Source para el router. */
export type { ExternalReviewSource }
