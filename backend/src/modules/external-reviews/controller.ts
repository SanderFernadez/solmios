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
//
// El endpoint público vive en opiniones (F0 0.11 GET /api/public/hotels/:slug/reviews) —
// F3 task 3.4 (NO en scope de 3.1-3.3) lo extiende para incluir external_reviews en el aggregate.
// Settings admin (3.5 "Reputación externa": creds + Sync now) irá en pieza paralela de frontend.
import type { HttpRequest, Logger } from 'arckode-framework'
import { validateSchema } from 'arckode-framework'
import { AuthError } from 'arckode-framework'
import type { ExternalReviewsService } from './service'
import { CreateExternalReviewSchema, UpdateExternalReviewSchema } from './validators/schema'
import type { CurrentUser, ExternalReviewsQuery, ExternalReviewSource } from './types'

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
}

/** Helper para evitar `as any` en los guards — exporta tipo Source para el router. */
export type { ExternalReviewSource }
