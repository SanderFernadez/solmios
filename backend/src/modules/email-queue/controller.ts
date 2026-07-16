import type { HttpRequest, Logger } from 'arckode-framework'
import type { EmailQueueService } from './service'
import type { EmailQueueQuery } from './types'

export class EmailQueueController {
  constructor(
    private readonly service: EmailQueueService,
    private readonly logger: Logger,
  ) {}

  async index(req: HttpRequest) {
    const currentUser = req.user as any
    const q = req.query as Record<string, string>
    const query: EmailQueueQuery = {
      hotelId: q.hotelId,
      status: q.status as EmailQueueQuery['status'],
      page: q.page ? Number(q.page) : undefined,
      limit: q.limit ? Number(q.limit) : undefined,
    }
    const result = await this.service.list(query, currentUser)
    return { status: 200, body: result }
  }

  async requeue(req: HttpRequest) {
    const currentUser = req.user as any
    const item = await this.service.requeue(req.params.id, currentUser)
    return { status: 200, body: item }
  }
}
