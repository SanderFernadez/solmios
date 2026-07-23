// compras/controller.ts — Adaptador HTTP. Traduce request → service → response. SIN lógica de negocio,
// SIN ORM directo. Toda mutación pasa por validateSchema().
import type { HttpRequest, Logger } from 'arckode-framework'
import { validateSchema } from '../../shared/validators/validate-body'
import type { ComprasService } from './service'
import {
  CreateRequisitionSchema, RequisitionLineSchema, RequisitionTransitionSchema,
  CreateOrderSchema, OrderLineSchema, OrderTransitionSchema,
  ReceiveSchema, InvoiceSchema,
} from './validators/schema'

export class ComprasController {
  constructor(private readonly service: ComprasService, private readonly logger: Logger) {}

  // ─── Requisiciones ───
  async indexReq(req: HttpRequest) {
    return { status: 200, body: await this.service.listRequisitions({ status: (req.query as any)?.status }, req.user as any) }
  }
  async showReq(req: HttpRequest) {
    return { status: 200, body: await this.service.getRequisition(req.params.id, req.user as any) }
  }
  async storeReq(req: HttpRequest) {
    this.logger.info('POST /compras/requisitions')
    const data = validateSchema(CreateRequisitionSchema, req.body)
    return { status: 201, body: await this.service.createRequisition(data as any, req.user as any) }
  }
  async addReqLine(req: HttpRequest) {
    const data = validateSchema(RequisitionLineSchema, req.body)
    return { status: 201, body: await this.service.addRequisitionLine(req.params.id, data as any, req.user as any) }
  }
  async removeReqLine(req: HttpRequest) {
    await this.service.removeRequisitionLine(req.params.id, req.params.lineId, req.user as any)
    return { status: 204, body: null }
  }
  async transitionReq(req: HttpRequest) {
    const data = validateSchema(RequisitionTransitionSchema, req.body) as any
    return { status: 200, body: await this.service.transitionRequisition(req.params.id, data.status, req.user as any) }
  }
  async destroyReq(req: HttpRequest) {
    await this.service.deleteRequisition(req.params.id, req.user as any)
    return { status: 204, body: null }
  }

  // ─── Órdenes de compra ───
  async indexOrder(req: HttpRequest) {
    const q = req.query as any
    return { status: 200, body: await this.service.listOrders({ status: q?.status, supplierId: q?.supplierId }, req.user as any) }
  }
  async showOrder(req: HttpRequest) {
    return { status: 200, body: await this.service.getOrder(req.params.id, req.user as any) }
  }
  async storeOrder(req: HttpRequest) {
    this.logger.info('POST /compras/orders')
    const data = validateSchema(CreateOrderSchema, req.body)
    return { status: 201, body: await this.service.createOrder(data as any, req.user as any) }
  }
  async addOrderLine(req: HttpRequest) {
    const data = validateSchema(OrderLineSchema, req.body)
    return { status: 201, body: await this.service.addOrderLine(req.params.id, data as any, req.user as any) }
  }
  async removeOrderLine(req: HttpRequest) {
    await this.service.removeOrderLine(req.params.id, req.params.lineId, req.user as any)
    return { status: 204, body: null }
  }
  async transitionOrder(req: HttpRequest) {
    const data = validateSchema(OrderTransitionSchema, req.body) as any
    return { status: 200, body: await this.service.transitionOrder(req.params.id, data.status, req.user as any) }
  }

  // ─── Recepción + facturación ───
  async receive(req: HttpRequest) {
    this.logger.info('POST /compras/orders/:id/receive', { id: req.params.id })
    const data = validateSchema(ReceiveSchema, req.body)
    return { status: 201, body: await this.service.receive(req.params.id, data as any, req.user as any) }
  }
  async listReceipts(req: HttpRequest) {
    return { status: 200, body: await this.service.listReceipts(req.params.id, req.user as any) }
  }
  async invoice(req: HttpRequest) {
    this.logger.info('POST /compras/orders/:id/invoice', { id: req.params.id })
    const data = validateSchema(InvoiceSchema, req.body) as any
    return { status: 200, body: await this.service.markInvoiced(req.params.id, data, req.user as any) }
  }
}
