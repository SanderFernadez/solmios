// reembolsos/controller.ts — Adaptador HTTP. SIN lógica de negocio. SIN ORM directo.

import type { HttpRequest, Logger } from 'arckode-framework'
import { validateSchema } from 'arckode-framework'
import type { ReembolsosService } from './service'
import {
  CreateReembolsosSchema, UpdateReembolsosSchema, PayClaimSchema, RejectClaimSchema,
} from './validators/schema'

export class ReembolsosController {
  constructor(
    private readonly service: ReembolsosService,
    private readonly logger: Logger,
  ) {}

  private hotelOf(req: HttpRequest): string {
    return (req as any).user?.hotelId ?? (req.query as any)?.hotelId ?? ''
  }
  private userId(req: HttpRequest): string {
    return (req as any).userId ?? (req as any).user?.id ?? ''
  }
  private withHotelId(req: HttpRequest): Record<string, unknown> {
    const body = (req.body ?? {}) as Record<string, unknown>
    return { ...body, hotelId: this.hotelOf(req) || body.hotelId }
  }

  async index(req: HttpRequest) {
    this.logger.info('GET /api/expense-claims')
    const q = req.query as any
    return { status: 200, body: await this.service.list({ hotelId: this.hotelOf(req), employeeId: q.employeeId, status: q.status }) }
  }

  async totals(req: HttpRequest) {
    return { status: 200, body: await this.service.totals(this.hotelOf(req)) }
  }

  async show(req: HttpRequest) {
    return { status: 200, body: await this.service.getById(req.params.id, (req as any).user) }
  }

  async store(req: HttpRequest) {
    this.logger.info('POST /api/expense-claims')
    const data = validateSchema(CreateReembolsosSchema, this.withHotelId(req))
    return { status: 201, body: await this.service.create(data as any) }
  }

  async update(req: HttpRequest) {
    const data = validateSchema(UpdateReembolsosSchema, req.body)
    return { status: 200, body: await this.service.update(req.params.id, data as any, (req as any).user) }
  }

  async submit(req: HttpRequest) {
    return { status: 200, body: await this.service.submit(req.params.id, (req as any).user) }
  }

  async approve(req: HttpRequest) {
    return { status: 200, body: await this.service.approve(req.params.id, this.userId(req), (req as any).user) }
  }

  async reject(req: HttpRequest) {
    const data = validateSchema(RejectClaimSchema, req.body) as { reason: string }
    return { status: 200, body: await this.service.reject(req.params.id, data.reason, this.userId(req), (req as any).user) }
  }

  async pay(req: HttpRequest) {
    this.logger.info('POST /api/expense-claims/:id/pay')
    const data = validateSchema(PayClaimSchema, req.body) as { paymentMethod: string }
    return { status: 200, body: await this.service.pay(req.params.id, data.paymentMethod, (req as any).user) }
  }

  async destroy(req: HttpRequest) {
    await this.service.delete(req.params.id, (req as any).user)
    return { status: 204, body: null }
  }
}
