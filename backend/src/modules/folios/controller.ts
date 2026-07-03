// folios/controller.ts — Adaptador HTTP del módulo de folios.
import type { HttpRequest, Logger } from 'arckode-framework'
import { validateSchema } from 'arckode-framework'
import type { FoliosService } from './service'
import { OpenFolioSchema, PostChargeSchema, ApplyPaymentSchema } from './validators/schema'

export class FoliosController {
  constructor(
    private readonly service: FoliosService,
    private readonly logger: Logger,
    private readonly orm?: any,
  ) {}

  async index(req: HttpRequest) {
    return { status: 200, body: await this.service.list(req.query as any, req.user as any) }
  }

  async show(req: HttpRequest) {
    return { status: 200, body: await this.service.getById(req.params.id, req.user as any) }
  }

  async store(req: HttpRequest) {
    const data = validateSchema(OpenFolioSchema, req.body)
    return { status: 201, body: await this.service.open(data as any, req.user as any) }
  }

  async charge(req: HttpRequest) {
    const data = validateSchema(PostChargeSchema, req.body)
    return { status: 201, body: await this.service.postCharge(req.params.id, data as any, req.user as any) }
  }

  async payment(req: HttpRequest) {
    const data = validateSchema(ApplyPaymentSchema, req.body)
    return { status: 201, body: await this.service.applyPayment(req.params.id, data as any, req.user as any) }
  }

  async close(req: HttpRequest) {
    return { status: 200, body: await this.service.close(req.params.id, req.user as any) }
  }

  async closeAndInvoice(req: HttpRequest) {
    return { status: 200, body: await this.service.closeAndInvoice(req.params.id, req.user as any) }
  }

  async postNightAuditRoomCharges(req: HttpRequest) {
    return { status: 200, body: await this.service.postNightAuditRoomCharges(req.user as any, req.query as any) }
  }
}
