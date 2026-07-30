// landing/controller.ts — Adaptador HTTP del módulo landing_blocks (F1).
// Responsabilidad ÚNICA: traducir request → service → response. SIN lógica de negocio,
// SIN llamadas directas al ORM. Toda mutación (POST/PUT/PATCH) pasa por validateSchema.
import type { HttpRequest, Logger } from 'arckode-framework'
// `validateSchema` del shared (superconjunto del framework): acepta `BodyRule`
// (incluye 'array'/'object'/'json'/'text') que usa este módulo. El del framework solo
// entiende string|number|boolean|email|url|date y descarta los demás en silencio.
import { validateSchema } from '../../shared/validators/validate-body'
import type { LandingService } from './service'
import { UpsertLandingSchema, ToggleLandingSchema, ThemeSchema } from './validators/schema'

export class LandingController {
  constructor(
    private readonly service: LandingService,
    private readonly logger: Logger,
  ) {}

  /** GET /api/landing — lista los 9 bloques del hotel del admin (seed si vacío). */
  async index(req: HttpRequest) {
    const user = req.user as any
    const hotelId = user?.hotelId
    if (!hotelId) throw new Error('Sin hotel asignado')
    this.logger.info('GET /api/landing', { hotelId })
    const result = await this.service.listByHotel(hotelId, user)
    return { status: 200, body: result }
  }

  /** PUT /api/landing — bulk upsert atómico del array completo. */
  async upsert(req: HttpRequest) {
    const user = req.user as any
    const hotelId = user?.hotelId
    if (!hotelId) throw new Error('Sin hotel asignado')
    this.logger.info('PUT /api/landing', { hotelId, count: (req.body as any)?.blocks?.length })
    const data = validateSchema(UpsertLandingSchema, req.body)
    const blocks = (data.blocks as any[]) ?? []
    const created = await this.service.upsert(hotelId, blocks, user)
    return { status: 200, body: { data: created, total: created.length } }
  }

  /** PATCH /api/landing/:id/toggle — toggle rápido sin re-PUT todo. */
  async toggle(req: HttpRequest) {
    const user = req.user as any
    this.logger.info('PATCH /api/landing/:id/toggle', { id: req.params.id })
    const data = validateSchema(ToggleLandingSchema, req.body)
    const block = await this.service.toggle(req.params.id, data.active as boolean, user)
    return { status: 200, body: block }
  }

  /** GET /api/public/hotels/:slug/landing — bloques activos del hotel (sin auth, rate-limited). */
  async publicLanding(req: HttpRequest) {
    const slug = req.params.slug
    const result = await this.service.listPublicBySlug(slug)
    return { status: 200, body: result }
  }

  /** GET /api/landing/theme — theme del hotel (default classic si no hay fila). */
  async getTheme(req: HttpRequest) {
    const user = req.user as any
    const hotelId = user?.hotelId
    if (!hotelId) throw new Error('Sin hotel asignado')
    this.logger.info('GET /api/landing/theme', { hotelId })
    const theme = await this.service.getTheme(hotelId)
    return { status: 200, body: theme }
  }

  /** PUT /api/landing/theme — persiste el theme (validateSchema + ownership + cache flush). */
  async setTheme(req: HttpRequest) {
    const user = req.user as any
    const hotelId = user?.hotelId
    if (!hotelId) throw new Error('Sin hotel asignado')
    this.logger.info('PUT /api/landing/theme', { hotelId, templateId: (req.body as any)?.templateId })
    const data = validateSchema(ThemeSchema, req.body)
    // `templateId` en enum + allow-list de colors/fonts se valida en el usecase
    // (mismo patrón que UpsertLandingSchema/`type`).
    const theme = await this.service.setTheme(hotelId, data, user)
    return { status: 200, body: theme }
  }
}
