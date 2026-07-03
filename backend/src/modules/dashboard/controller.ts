import type { HttpRequest, Logger } from 'arckode-framework'
import type { DashboardService } from './service'

export class DashboardController {
  constructor(
    private readonly service: DashboardService,
    private readonly logger: Logger,
  ) {}

  async getDashboard(req: HttpRequest) {
    return { status: 200, body: await this.service.getDashboard(req) }
  }

  async getPlanning(req: HttpRequest) {
    return { status: 200, body: await this.service.getPlanning(req) }
  }

  async getCheckinList(req: HttpRequest) {
    return { status: 200, body: await this.service.getCheckinList(req) }
  }
}
