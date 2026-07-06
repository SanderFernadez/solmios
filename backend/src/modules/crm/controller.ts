// crm/controller.ts
import type { HttpRequest, Logger } from 'arckode-framework'
import { validateSchema } from 'arckode-framework'
import type { CrmService } from './service'
import { AwardPointsSchema, RedeemPointsSchema, CreateCouponSchema, ValidateCouponSchema, CreateSegmentSchema } from './validators/schema'

export class CrmController {
  constructor(private readonly service: CrmService, private readonly logger: Logger) {}

  async awardPoints(req: HttpRequest) {
    const b = validateSchema(AwardPointsSchema, req.body) as any
    return { status: 201, body: await this.service.awardPoints(b.guestId, (req as any).user?.hotelId, b.points, b.description, b.reservationId, (req as any).user?.role) }
  }
  async redeemPoints(req: HttpRequest) {
    const b = validateSchema(RedeemPointsSchema, req.body) as any
    return { status: 200, body: await this.service.redeemPoints(b.guestId, (req as any).user?.hotelId, b.points, b.description, (req as any).user?.role) }
  }
  async getPointsHistory(req: HttpRequest) { return { status: 200, body: await this.service.getPointsHistory(req.params.guestId, (req as any).user?.hotelId, (req as any).user?.role) } }
  async getPointsBalance(req: HttpRequest) { return { status: 200, body: { balance: await this.service.getPointsBalance(req.params.guestId, (req as any).user?.hotelId, (req as any).user?.role) } } }

  async createCoupon(req: HttpRequest) {
    const d = validateSchema(CreateCouponSchema, req.body) as any
    d.hotelId = (req as any).user?.hotelId ?? d.hotelId
    return { status: 201, body: await this.service.createCoupon(d) }
  }
  async listCoupons(req: HttpRequest) { return { status: 200, body: await this.service.listCoupons((req as any).user?.hotelId ?? (req.query as any).hotelId) } }
  async validateCoupon(req: HttpRequest) {
    const b = validateSchema(ValidateCouponSchema, req.body) as any
    return { status: 200, body: await this.service.validateCoupon(b.code, (req as any).user?.hotelId, b.amount) }
  }
  async deleteCoupon(req: HttpRequest) { await this.service.deleteCoupon(req.params.id, (req as any).user?.hotelId, (req as any).user?.role); return { status: 204, body: null } }

  async createSegment(req: HttpRequest) {
    const d = validateSchema(CreateSegmentSchema, req.body) as any
    d.hotelId = (req as any).user?.hotelId ?? d.hotelId
    return { status: 201, body: await this.service.createSegment(d) }
  }
  async listSegments(req: HttpRequest) { return { status: 200, body: await this.service.listSegments((req as any).user?.hotelId ?? (req.query as any).hotelId) } }
  async getGuestsInSegment(req: HttpRequest) { return { status: 200, body: await this.service.getGuestsInSegment((req as any).user?.hotelId, req.params.id, (req as any).user?.role) } }

  async getLTV(req: HttpRequest) { return { status: 200, body: await this.service.calculateLTV((req as any).user?.hotelId ?? (req.query as any).hotelId) } }
  async getDashboard(req: HttpRequest) { return { status: 200, body: await this.service.getDashboard((req as any).user?.hotelId ?? (req.query as any).hotelId) } }
}
