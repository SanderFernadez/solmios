import type { HttpRequest, Logger } from 'arckode-framework'
import type { PricingService } from './service'

export class PricingController {
  constructor(
    private readonly service: PricingService,
    private readonly logger: Logger,
  ) {}

  private async hotelOf(req: any): Promise<string | undefined> {
    const q = req?.query || {}
    if (q.hotelId) return q.hotelId as string
    const userHotel = req?.user?.hotelId
    if (userHotel && userHotel !== 'platform') return userHotel as string
    if (req?.user?.id && req?.user?.role !== 'super_admin') {
      const uRows = await (this.service as any).orm?.findMany?.('Users', { id: req.user.id }) || []
      const u: any = uRows?.[0]
      if (u?.hotelId) return u.hotelId
    }
    return undefined
  }

  async listSeasons(req: HttpRequest) {
    const id = await this.hotelOf(req); if (!id) return { status: 200, body: { data: [] } }
    return { status: 200, body: { data: await this.service.listSeasons(id) } }
  }

  async updateSeasons(req: HttpRequest) {
    const id = await this.hotelOf(req); if (!id) return { status: 400, body: { error: 'hotelId requerido' } }
    const { seasons } = req.body as any
    if (!Array.isArray(seasons)) return { status: 400, body: { error: 'seasons debe ser un array' } }
    return { status: 200, body: { success: true, count: await this.service.updateSeasons(id, seasons) } }
  }

  async listRates(req: HttpRequest) {
    const id = await this.hotelOf(req); if (!id) return { status: 200, body: { data: [] } }
    return { status: 200, body: { data: await this.service.listRates(id) } }
  }

  async updateRates(req: HttpRequest) {
    const id = await this.hotelOf(req); if (!id) return { status: 400, body: { error: 'hotelId requerido' } }
    const { rates } = req.body as any
    if (!Array.isArray(rates)) return { status: 400, body: { error: 'rates debe ser un array' } }
    return { status: 200, body: { success: true, count: await this.service.updateRates(id, rates) } }
  }

  async copyRatesNextYear(req: HttpRequest) {
    const id = await this.hotelOf(req); if (!id) return { status: 400, body: { error: 'hotelId requerido' } }
    return { status: 200, body: { success: true, ...await this.service.copyRatesNextYear(id) } }
  }

  async listBlocks(req: HttpRequest) {
    const id = await this.hotelOf(req); if (!id) return { status: 200, body: { data: [] } }
    const { startDate, endDate } = req.query as any
    return { status: 200, body: { data: await this.service.listBlocks(id, startDate, endDate) } }
  }

  async createBlocks(req: HttpRequest) {
    const id = await this.hotelOf(req); if (!id) return { status: 400, body: { error: 'hotelId requerido' } }
    const { roomIds, reason, startDate, endDate } = req.body as any
    if (!roomIds?.length || !startDate || !endDate) return { status: 400, body: { error: 'roomIds, startDate, endDate requeridos' } }
    const created = await this.service.createBlocks(id, (req.user as any)?.id || '', roomIds, reason, startDate, endDate)
    return { status: 201, body: { data: created, count: created.length } }
  }

  async deleteBlock(req: HttpRequest) {
    await this.service.deleteBlock(req.params.id)
    return { status: 200, body: { success: true } }
  }

  async listRateRestrictions(req: HttpRequest) {
    const id = await this.hotelOf(req); if (!id) return { status: 200, body: { data: [] } }
    return { status: 200, body: { data: await this.service.listRateRestrictions(id) } }
  }

  async updateRateRestrictions(req: HttpRequest) {
    const id = await this.hotelOf(req); if (!id) return { status: 400, body: { error: 'hotelId requerido' } }
    const { restrictions } = req.body as any
    if (!Array.isArray(restrictions)) return { status: 400, body: { error: 'restrictions debe ser un array' } }
    return { status: 200, body: { success: true, count: await this.service.updateRateRestrictions(id, restrictions) } }
  }

  async getChannelMetrics(req: HttpRequest) {
    const id = await this.hotelOf(req); if (!id) return { status: 200, body: { data: [] } }
    return { status: 200, body: { data: await this.service.getChannelMetrics(id) } }
  }
}
