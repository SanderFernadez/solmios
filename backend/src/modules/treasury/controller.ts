// treasury/controller.ts — Adaptador HTTP. Traduce request → service → response. Sin lógica ni ORM.
import type { HttpRequest, Logger } from 'arckode-framework'
import { validateSchema } from '../../shared/validators/validate-body'
import type { TreasuryService } from './service'
import { CreateSupplierSchema, UpdateSupplierSchema } from './validators/schema'

export class TreasuryController {
  constructor(private readonly service: TreasuryService, private readonly logger: Logger) {}

  async cashFlow(req: HttpRequest) {
    const q = req.query as any
    const group = q?.group === 'day' ? 'day' : 'month'
    return { status: 200, body: await this.service.cashFlow(q?.from, q?.to, group, req.user as any) }
  }
  async receivables(req: HttpRequest) {
    return { status: 200, body: await this.service.receivables(req.user as any) }
  }
  async payables(req: HttpRequest) {
    return { status: 200, body: await this.service.payables(req.user as any) }
  }

  async indexSuppliers(req: HttpRequest) {
    const items = await this.service.listSuppliers(req.user as any)
    return { status: 200, body: { data: items, total: items.length } }
  }
  async storeSupplier(req: HttpRequest) {
    const data = validateSchema(CreateSupplierSchema, req.body)
    const item = await this.service.createSupplier(data as any, req.user as any)
    return { status: 201, body: item }
  }
  async updateSupplier(req: HttpRequest) {
    const data = validateSchema(UpdateSupplierSchema, req.body)
    const item = await this.service.updateSupplier(req.params.id, data as any, req.user as any)
    return { status: 200, body: item }
  }
  async destroySupplier(req: HttpRequest) {
    await this.service.deleteSupplier(req.params.id, req.user as any)
    return { status: 204, body: null }
  }
}
