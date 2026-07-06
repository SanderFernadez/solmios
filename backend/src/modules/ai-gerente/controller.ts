// ai-gerente/controller.ts — Adaptador HTTP de M17 Gerente IA.
import type { HttpRequest, Logger } from 'arckode-framework'
import { validateSchema } from 'arckode-framework'
import type { AiGerenteService } from './service'
import { AskSchema, FeedbackSchema } from './validators/schema'

export class AiGerenteController {
  constructor(
    private readonly service: AiGerenteService,
    private readonly logger: Logger,
  ) {}

  /** POST /api/ai/manager/ask — body: { query } */
  async ask(req: HttpRequest) {
    const data = validateSchema(AskSchema, req.body) as any
    const user = (req as any).user
    const interaction = await this.service.ask(data.query.trim(), user, data.hotelId)
    return { status: 200, body: interaction }
  }

  /** GET /api/ai/manager/interactions */
  async index(req: HttpRequest) {
    const user = (req as any).user
    const result = await this.service.list({ ...(req.query as any), hotelId: user?.hotelId })
    return { status: 200, body: result }
  }

  /** PATCH /api/ai/manager/interactions/:id/feedback — body: { feedback } */
  async feedback(req: HttpRequest) {
    const user = (req as any).user
    const data = validateSchema(FeedbackSchema, req.body) as any
    const updated = await this.service.feedback(req.params.id, data.feedback, user)
    return { status: 200, body: updated }
  }
}
