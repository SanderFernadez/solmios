import type { HttpRequest, Logger } from 'arckode-framework'
import { validateSchema } from 'arckode-framework'
import type { ReferralsService } from './service'
import { UpdateReferralProgramSchema, CreateReferralTierSchema, UpdateReferralTierSchema } from './validators/schema'

export class ReferralsController {
  constructor(
    private readonly service: ReferralsService,
    private readonly logger: Logger,
  ) {}

  // ── Admin ──
  async getProgram() {
    return { status: 200, body: await this.service.getProgram() }
  }
  async updateProgram(req: HttpRequest) {
    try {
      const data = validateSchema(UpdateReferralProgramSchema, req.body) as any
      return { status: 200, body: await this.service.updateProgram(data) }
    } catch (e: any) {
      return { status: 400, body: { error: e.message } }
    }
  }
  async listTiers() {
    return { status: 200, body: await this.service.listTiers() }
  }
  async createTier(req: HttpRequest) {
    try {
      const data = validateSchema(CreateReferralTierSchema, req.body) as any
      return { status: 201, body: await this.service.createTier(data) }
    } catch (e: any) {
      return { status: 400, body: { error: e.message } }
    }
  }
  async updateTier(req: HttpRequest) {
    try {
      const data = validateSchema(UpdateReferralTierSchema, req.body) as any
      return { status: 200, body: await this.service.updateTier(req.params.id, data, req.user as any) }
    } catch (e: any) {
      return { status: e.message?.includes('no encontrado') ? 404 : 400, body: { error: e.message } }
    }
  }
  async deleteTier(req: HttpRequest) {
    try {
      await this.service.deleteTier(req.params.id, req.user as any)
      return { status: 200, body: { success: true } }
    } catch (e: any) {
      return { status: 404, body: { error: e.message } }
    }
  }
  async getMetrics() {
    return { status: 200, body: await this.service.getMetrics() }
  }

  // ── Merchant ──
  async myReferrals(req: HttpRequest) {
    const hotelId = (req.user as any)?.hotelId
    return { status: 200, body: await this.service.myReferrals(hotelId) }
  }

  // ── Público ──
  async resolveCode(req: HttpRequest) {
    try {
      const code = String((req.query as any)?.code ?? '')
      return { status: 200, body: await this.service.resolveCode(code) }
    } catch (e: any) {
      return { status: 404, body: { error: e.message } }
    }
  }
}
