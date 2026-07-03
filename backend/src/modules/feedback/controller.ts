import type { HttpRequest, Logger } from 'arckode-framework'
import type { FeedbackService } from './service'

export class FeedbackController {
  constructor(
    private readonly service: FeedbackService,
    private readonly logger: Logger,
  ) {}

  async createGitLabIssue(req: HttpRequest) {
    try {
      const result = await this.service.createGitLabIssue(req.body, req.user)
      return { status: 201, body: result }
    } catch (e: any) {
      return { status: 502, body: { error: e.message } }
    }
  }
}
