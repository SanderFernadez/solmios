// ai-gerente/controller.ts — Adaptador HTTP de M17 Gerente IA.
import type { HttpRequest, Logger } from 'arckode-framework'
import type { AiGerenteService } from './service'

const FEEDBACK_VALUES = ['helpful', 'not_helpful', 'inaccurate']

export class AiGerenteController {
  constructor(
    private readonly service: AiGerenteService,
    private readonly logger: Logger,
  ) {}

  /** POST /api/ai/manager/ask — body: { query } */
  async ask(req: HttpRequest) {
    const query = (req.body as any)?.query
    if (!query || !String(query).trim()) return { status: 400, body: { error: 'query es requerido' } }
    const user = (req as any).user
    const hotelId = (req.body as any)?.hotelId
    const interaction = await this.service.ask(String(query).trim(), user, hotelId)
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
    const feedback = (req.body as any)?.feedback
    if (!FEEDBACK_VALUES.includes(feedback)) {
      return { status: 400, body: { error: `feedback debe ser uno de: ${FEEDBACK_VALUES.join(', ')}` } }
    }
    const updated = await this.service.feedback(req.params.id, feedback)
    return { status: 200, body: updated }
  }
}
