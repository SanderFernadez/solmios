import type { HttpRequest, Logger } from 'arckode-framework'
import { validateSchema } from 'arckode-framework'
import type { FeedbackService } from './service'
import { CreateFeedbackPinSchema, UpdateFeedbackPinSchema } from './validators/schema'

export class FeedbackController {
  constructor(
    private readonly service: FeedbackService,
    private readonly logger: Logger,
  ) {}

  // ── CRUD Feedback Pins ──────────────────────────────────────────────────
  async listPins(req: HttpRequest) {
    const { hotelId, route } = req.query as any
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
    const deleted = await this.service.deletePin(req.params.id)
    if (!deleted) return { status: 404, body: { error: 'Pin no encontrado' } }
    return { status: 204, body: null }
  }

  // ── GitLab Issue ────────────────────────────────────────────────────────
  async createGitLabIssue(req: HttpRequest) {
    try {
      const result = await this.service.createGitLabIssue(req.body, req.user)
      return { status: 201, body: result }
    } catch (e: any) {
      return { status: 502, body: { error: e.message } }
    }
  }
}
