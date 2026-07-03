import type { Logger } from 'arckode-framework'
import type { DashboardQueries } from './usecases/dashboard-queries'

export class DashboardService {
  constructor(
    private readonly logger: Logger,
    private readonly queries: DashboardQueries,
  ) {}

  async getDashboard(req: any): Promise<any> {
    const id = await this.queries.resolveHotelId(req); if (!id) return {}
    return this.queries.getDashboard(id)
  }

  async getPlanning(req: any): Promise<any> {
    const id = await this.queries.resolveHotelId(req); if (!id) return { rooms: [], reservas: [] }
    return this.queries.getPlanning(id)
  }

  async getCheckinList(req: any): Promise<any> {
    const id = await this.queries.resolveHotelId(req)
    if (!id) return { checkins: [], checkouts: [], pendingCheckins: 0, todayCheckouts: 0 }
    return this.queries.getCheckinList(id)
  }
}
