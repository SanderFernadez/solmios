import type { HttpRequest, Logger } from 'arckode-framework'
import { validateSchema } from 'arckode-framework'
import type { FeedbackService } from './service'
import { CreateFeedbackPinSchema, UpdateFeedbackPinSchema, CreateGitLabIssueSchema } from './validators/schema'
import { resolveTenant } from '../../shared/utils/resolve-tenant'
import { rateLimit, getClientIp } from '../../shared/middlewares/rate-limit'

export class FeedbackController {
  constructor(
    private readonly service: FeedbackService,
    private readonly logger: Logger,
  ) {}

  // ── CRUD Feedback Pins ──────────────────────────────────────────────────
  async listPins(req: HttpRequest) {
    const { route } = req.query as any
    // resolveTenant, NO el hotelId de la query: un merchant queda forzado a su hotel. Antes,
    // ?hotelId=B leía el feedback de otro hotel y sin el param dumpeaba TODOS los hoteles.
    const hotelId = resolveTenant(req)
    const result = await this.service.listPins(hotelId, route)
    return { status: 200, body: result }
  }

  async getPin(req: HttpRequest) {
    const pin = await this.service.getPin(req.params.id, req.user)
    if (!pin) return { status: 404, body: { error: 'Pin no encontrado' } }
    return { status: 200, body: pin }
  }

  async createPin(req: HttpRequest) {
    const data = validateSchema(CreateFeedbackPinSchema, req.body)
    const user = req.user as any
    const pin = await this.service.createPin({
      ...data as any,
      userId: user?.id,
      userEmail: user?.email,
      hotelId: data.hotelId || user?.hotelId,
    })
    return { status: 201, body: pin }
  }

  async updatePin(req: HttpRequest) {
    const data = validateSchema(UpdateFeedbackPinSchema, req.body)
    const pin = await this.service.updatePin(req.params.id, data as any, req.user)
    if (!pin) return { status: 404, body: { error: 'Pin no encontrado' } }
    return { status: 200, body: pin }
  }

  async deletePin(req: HttpRequest) {
    const deleted = await this.service.deletePin(req.params.id, req.user)
    if (!deleted) return { status: 404, body: { error: 'Pin no encontrado' } }
    return { status: 204, body: null }
  }

  // ── GitLab Issue ────────────────────────────────────────────────────────
  // La ruta abrió a cualquier logueado (feedback es del usuario, no de admin). Esto crea un issue
  // REAL en GitLab: rate-limit por usuario (fallback IP) para que no llenen el repo a mano o con un
  // loop. Reutiliza el limiter compartido (MAX_ATTEMPTS=20 / 5min) con una key propia.
  async createGitLabIssue(req: HttpRequest) {
    const user = req.user as any
    const limiterKey = `feedback-gl:${user?.id || getClientIp(req)}`
    const { allowed, retryAfter } = rateLimit(limiterKey)
    if (!allowed) {
      return { status: 429, body: { error: `Demasiados reportes. Reintentá en ${retryAfter}s.`, retryAfter } }
    }
    try {
      const data = validateSchema(CreateGitLabIssueSchema, req.body)
      const result = await this.service.createGitLabIssue(data, req.user)
      return { status: 201, body: result }
    } catch (e: any) {
      return { status: 502, body: { error: e.message } }
    }
  }
}
