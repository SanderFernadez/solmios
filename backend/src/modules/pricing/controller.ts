import type { HttpRequest, Logger } from 'arckode-framework'
import { validateSchema } from 'arckode-framework'
import type { PricingService } from './service'
import {
  UpdateSeasonsSchema, UpdateRatesSchema, UpdateRateRestrictionsSchema, CreateBlockSchema,
  ActivateSeasonSchema, UpdateDateRestrictionsSchema,
  validateRateItems, validateSeasonItems, validateRestrictionItems, validateBlockRange,
  validateDateRestrictionItems,
} from './validators/schema'

export class PricingController {
  constructor(
    private readonly service: PricingService,
    private readonly logger: Logger,
  ) {}

  /** SC-05: quién ejecuta el cambio de tarifa. Sin esto el audit log no sirve de nada. */
  private actorOf(req: any): { id?: string; role?: string } | undefined {
    const user = req?.user
    return user ? { id: user.id, role: user.role } : undefined
  }

  private async hotelOf(req: any): Promise<string | undefined> {
    const q = req?.query || {}
    // Seguridad (IDOR cross-tenant): el hotel sale del TOKEN, no de la query. Un usuario de hotel
    // NO puede apuntar a otro hotel pasando ?hotelId=. Solo super_admin (platform) puede cross-hotel.
    const userHotel = req?.user?.hotelId
    if (userHotel && userHotel !== 'platform') return userHotel as string
    if (req?.user?.role === 'super_admin' && q.hotelId) return q.hotelId as string
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
    validateSchema(UpdateSeasonsSchema, req.body)
    const { seasons } = req.body as any
    validateSeasonItems(seasons)
    return { status: 200, body: { success: true, count: await this.service.updateSeasons(id, seasons, this.actorOf(req)) } }
  }

  async activateSeason(req: HttpRequest) {
    const id = await this.hotelOf(req); if (!id) return { status: 400, body: { error: 'hotelId requerido' } }
    validateSchema(ActivateSeasonSchema, req.body)
    const { name } = req.body as any
    return { status: 200, body: { success: true, data: await this.service.activateSeason(id, String(name), this.actorOf(req)) } }
  }

  async listRates(req: HttpRequest) {
    const id = await this.hotelOf(req); if (!id) return { status: 200, body: { data: [] } }
    return { status: 200, body: { data: await this.service.listRates(id) } }
  }

  async updateRates(req: HttpRequest) {
    const id = await this.hotelOf(req); if (!id) return { status: 400, body: { error: 'hotelId requerido' } }
    validateSchema(UpdateRatesSchema, req.body)
    const { rates } = req.body as any
    validateRateItems(rates)
    return { status: 200, body: { success: true, count: await this.service.updateRates(id, rates, this.actorOf(req)) } }
  }

  async copyRatesNextYear(req: HttpRequest) {
    const id = await this.hotelOf(req); if (!id) return { status: 400, body: { error: 'hotelId requerido' } }
    return { status: 200, body: { success: true, ...await this.service.copyRatesNextYear(id, this.actorOf(req)) } }
  }

  async listBlocks(req: HttpRequest) {
    const id = await this.hotelOf(req); if (!id) return { status: 200, body: { data: [] } }
    const { startDate, endDate } = req.query as any
    return { status: 200, body: { data: await this.service.listBlocks(id, startDate, endDate) } }
  }

  async createBlocks(req: HttpRequest) {
    const id = await this.hotelOf(req); if (!id) return { status: 400, body: { error: 'hotelId requerido' } }
    validateSchema(CreateBlockSchema, req.body)
    const { roomIds, reason, startDate, endDate } = req.body as any
    if (!roomIds?.length) return { status: 400, body: { error: 'roomIds requerido' } }
    validateBlockRange(startDate, endDate)
    const created = await this.service.createBlocks(id, (req.user as any)?.id || '', roomIds, reason, startDate, endDate)
    return { status: 201, body: { data: created, count: created.length } }
  }

  async deleteBlock(req: HttpRequest) {
    const id = await this.hotelOf(req); if (!id) return { status: 400, body: { error: 'hotelId requerido' } }
    await this.service.deleteBlock(req.params.id, id, this.actorOf(req))
    return { status: 200, body: { success: true } }
  }

  async listRateRestrictions(req: HttpRequest) {
    const id = await this.hotelOf(req); if (!id) return { status: 200, body: { data: [] } }
    return { status: 200, body: { data: await this.service.listRateRestrictions(id) } }
  }

  async updateRateRestrictions(req: HttpRequest) {
    const id = await this.hotelOf(req); if (!id) return { status: 400, body: { error: 'hotelId requerido' } }
    validateSchema(UpdateRateRestrictionsSchema, req.body)
    const { restrictions } = req.body as any
    validateRestrictionItems(restrictions)
    return { status: 200, body: { success: true, count: await this.service.updateRateRestrictions(id, restrictions, this.actorOf(req)) } }
  }

  async getChannelMetrics(req: HttpRequest) {
    const id = await this.hotelOf(req); if (!id) return { status: 200, body: { data: [] } }
    return { status: 200, body: { data: await this.service.getChannelMetrics(id) } }
  }

  async listDateRestrictions(req: HttpRequest) {
    const id = await this.hotelOf(req); if (!id) return { status: 200, body: { data: [] } }
    const { from, to } = (req.query || {}) as any
    return { status: 200, body: { data: await this.service.listDateRestrictions(id, from, to) } }
  }

  async updateDateRestrictions(req: HttpRequest) {
    const id = await this.hotelOf(req); if (!id) return { status: 400, body: { error: 'hotelId requerido' } }
    validateSchema(UpdateDateRestrictionsSchema, req.body)
    const { items } = req.body as any
    validateDateRestrictionItems(items)
    return { status: 200, body: { success: true, count: await this.service.updateDateRestrictions(id, items, this.actorOf(req)) } }
  }
}
