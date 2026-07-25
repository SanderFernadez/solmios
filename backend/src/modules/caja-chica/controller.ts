// caja-chica/controller.ts — Adaptador HTTP. Traduce request → service → response. Sin lógica ni ORM.
import type { HttpRequest, Logger } from 'arckode-framework'
import { validateSchema } from '../../shared/validators/validate-body'
import type { CajaChicaService } from './service'
import { CreateFundSchema, UpdateFundSchema, CreateReplenishmentSchema } from './validators/schema'

export class CajaChicaController {
  constructor(private readonly service: CajaChicaService, private readonly logger: Logger) {}

  // ─── Fondos ───
  async indexFunds(req: HttpRequest) {
    const items = await this.service.listFunds(req.user as any)
    return { status: 200, body: { data: items, total: items.length } }
  }
  async showFund(req: HttpRequest) {
    return { status: 200, body: await this.service.getFund(req.params.id, req.user as any) }
  }
  async storeFund(req: HttpRequest) {
    const data = validateSchema(CreateFundSchema, req.body)
    const item = await this.service.createFund(data as any, req.user as any)
    return { status: 201, body: item }
  }
  async updateFund(req: HttpRequest) {
    const data = validateSchema(UpdateFundSchema, req.body)
    const item = await this.service.updateFund(req.params.id, data as any, req.user as any)
    return { status: 200, body: item }
  }
  async destroyFund(req: HttpRequest) {
    await this.service.deleteFund(req.params.id, req.user as any)
    return { status: 204, body: null }
  }

  // ─── Reposiciones ───
  async indexReplenishments(req: HttpRequest) {
    const items = await this.service.listReplenishments(req.params.id, req.user as any)
    return { status: 200, body: { data: items, total: items.length } }
  }
  async storeReplenishment(req: HttpRequest) {
    const data = validateSchema(CreateReplenishmentSchema, req.body)
    const item = await this.service.requestReplenishment(data as any, req.user as any)
    return { status: 201, body: item }
  }
  async completeReplenishment(req: HttpRequest) {
    const item = await this.service.completeReplenishment(req.params.id, req.user as any)
    return { status: 200, body: item }
  }
}
