import type { HttpRequest, Logger } from 'arckode-framework'
import { validateSchema, ValidationError } from 'arckode-framework'
import type { AliadosService } from './service'
import {
  SetPayoutModeSchema, CommissionTierItemSchema, UpdateReferredHotelSchema, EscalateHotelSchema,
} from './validators/schema'

export class AliadosController {
  constructor(
    private readonly service: AliadosService,
    private readonly logger: Logger,
  ) {}

  // ── Hotel-side ──
  async eligibility(req: HttpRequest) {
    const hotelId = (req.user as any)?.hotelId
    return { status: 200, body: await this.service.eligibility(hotelId) }
  }

  async convert(req: HttpRequest) {
    try {
      const hotelId = (req.user as any)?.hotelId
      return { status: 201, body: await this.service.convert(hotelId) }
    } catch (e: any) {
      return { status: e.httpStatus ?? 400, body: { error: e.message } }
    }
  }

  async me(req: HttpRequest) {
    const hotelId = (req.user as any)?.hotelId
    return { status: 200, body: await this.service.me(hotelId) }
  }

  async setPayoutMode(req: HttpRequest) {
    try {
      const data = validateSchema(SetPayoutModeSchema, req.body) as any
      const hotelId = (req.user as any)?.hotelId
      return { status: 200, body: await this.service.setPayoutMode(hotelId, data.mode) }
    } catch (e: any) {
      return { status: e.httpStatus ?? 400, body: { error: e.message } }
    }
  }

  async applyForCertification(req: HttpRequest) {
    try {
      const hotelId = (req.user as any)?.hotelId
      const answers = (req.body as any)?.answers
      return { status: 201, body: await this.service.applyForCertification(hotelId, answers) }
    } catch (e: any) {
      return { status: e.httpStatus ?? 400, body: { error: e.message } }
    }
  }

  // ── #559: soporte a hoteles referidos (solo aliado_certificado) ──
  async myReferredHotels(req: HttpRequest) {
    try {
      const hotelId = (req.user as any)?.hotelId
      return { status: 200, body: await this.service.myReferredHotels(hotelId) }
    } catch (e: any) {
      return { status: e.httpStatus ?? 400, body: { error: e.message } }
    }
  }

  async updateReferredHotel(req: HttpRequest) {
    try {
      const data = validateSchema(UpdateReferredHotelSchema, req.body) as any
      const hotelId = (req.user as any)?.hotelId
      return { status: 200, body: await this.service.updateReferredHotel(hotelId, req.params.hotelId, data) }
    } catch (e: any) {
      return { status: e.httpStatus ?? 400, body: { error: e.message } }
    }
  }

  async escalateReferredHotel(req: HttpRequest) {
    try {
      const data = validateSchema(EscalateHotelSchema, req.body) as any
      const user = req.user as any
      await this.service.escalate(user?.hotelId, req.params.hotelId, data.comment, user?.id)
      return { status: 201, body: { success: true } }
    } catch (e: any) {
      return { status: e.httpStatus ?? 400, body: { error: e.message } }
    }
  }

  // ── Admin ──
  async listPartners() {
    return { status: 200, body: await this.service.listPartners() }
  }

  async listCertificationRequests() {
    return { status: 200, body: await this.service.listCertificationRequests() }
  }

  async approveCertification(req: HttpRequest) {
    try {
      const reviewedBy = (req.user as any)?.id ?? ''
      return { status: 200, body: await this.service.approveCertification(req.params.id, reviewedBy) }
    } catch (e: any) {
      return { status: e.httpStatus ?? 400, body: { error: e.message } }
    }
  }

  async rejectCertification(req: HttpRequest) {
    try {
      const reviewedBy = (req.user as any)?.id ?? ''
      return { status: 200, body: await this.service.rejectCertification(req.params.id, reviewedBy) }
    } catch (e: any) {
      return { status: e.httpStatus ?? 400, body: { error: e.message } }
    }
  }

  async listTiers() {
    return { status: 200, body: await this.service.listTiers() }
  }

  async replaceTiers(req: HttpRequest) {
    try {
      const body = req.body
      if (!Array.isArray(body)) throw new ValidationError('El body debe ser un array de tramos')
      const validated = body.map((item) => validateSchema(CommissionTierItemSchema, item))
      return { status: 200, body: await this.service.replaceTiers(validated, req.user as any) }
    } catch (e: any) {
      return { status: e.httpStatus ?? 400, body: { error: e.message } }
    }
  }

  async markCommissionPaid(req: HttpRequest) {
    try {
      return { status: 200, body: await this.service.markCommissionPaid(req.params.id) }
    } catch (e: any) {
      return { status: e.httpStatus ?? 400, body: { error: e.message } }
    }
  }
}
