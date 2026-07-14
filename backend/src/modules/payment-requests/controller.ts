// payment-requests/controller.ts — Adaptador HTTP del módulo.
// Traduce request → service → response. SIN lógica de negocio, SIN ORM directo.
// Toda mutación POST/PUT pasa por validateSchema().

import type { HttpRequest, Logger } from 'arckode-framework'
import { validateSchema } from 'arckode-framework'
import type { PaymentRequestsService } from './service'
import type { CurrentUser } from './types'
import { CreatePaymentRequestSchema, UpdatePaymentRequestSchema } from './validators/schema'

export class PaymentRequestsController {
  constructor(
    private readonly service: PaymentRequestsService,
    private readonly logger: Logger,
  ) {}

  async index(req: HttpRequest) {
    const result = await this.service.list(req.query as any, req.user as CurrentUser)
    return { status: 200, body: result }
  }

  async show(req: HttpRequest) {
    const item = await this.service.getById(req.params.id, req.user as CurrentUser)
    return { status: 200, body: item }
  }

  async store(req: HttpRequest) {
    const data = validateSchema(CreatePaymentRequestSchema, req.body) as any
    const item = await this.service.create(data, req.user as CurrentUser)
    return { status: 201, body: item }
  }

  async update(req: HttpRequest) {
    const data = validateSchema(UpdatePaymentRequestSchema, req.body) as any
    const item = await this.service.update(req.params.id, data, req.user as CurrentUser)
    return { status: 200, body: item }
  }

  async destroy(req: HttpRequest) {
    await this.service.delete(req.params.id, req.user as CurrentUser)
    return { status: 200, body: { success: true } } // preserva respuesta original del inline
  }

  async stripeStatus(req: HttpRequest) {
    const result = await this.service.stripeStatus(req.user as CurrentUser)
    return { status: 200, body: result }
  }

  async createCheckout(req: HttpRequest) {
    const origin = (req.headers?.origin as string) || ''
    const result = await this.service.createCheckout(req.params.id, req.user as CurrentUser, origin)
    // El service puede devolver un error HTTP {status, body} o el éxito {url, sessionId}.
    if (result && typeof (result as any).status === 'number') return result as { status: number; body: any }
    return { status: 200, body: result }
  }

  async webhook(req: HttpRequest) {
    const hotelId = String(req.params?.hotelId || '')
    const signature = (req.headers as any)?.['stripe-signature'] || ''
    // Los bytes CRUDOS: JSON.stringify(req.body) NO reproduce la firma (orden de claves,
    // espacios, unicode). Framework >= 1.6.3 los expone como req.rawBody.
    const rawBody = (req as any).rawBody
    if (!rawBody) return { status: 400, body: { error: 'Webhook sin body' } }
    const result = await this.service.handleWebhook(hotelId, rawBody, signature)
    if (result && typeof (result as any).status === 'number') return result as { status: number; body: any }
    return { status: 200, body: result }
  }
}
