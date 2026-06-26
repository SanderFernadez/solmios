// payments/controller.ts — Adaptador HTTP del módulo

import type { HttpRequest, Logger } from 'arckode-framework'
import { validateSchema } from 'arckode-framework'
import type { PaymentsService } from './service'
import type {
  CreatePaymentDTO, ChargeCardDTO, CreatePaymentLinkDTO,
  CreateDepositDTO, RefundDepositDTO, PaymentsQuery, ReconciliationEntry,
} from './types'
import {
  CreatePaymentSchema, ChargeCardSchema, CreatePaymentLinkSchema,
  CreateDepositSchema, RefundDepositSchema, ReconcileSchema,
} from './validators/schema'

export class PaymentsController {
  constructor(
    private readonly service: PaymentsService,
    private readonly logger: Logger,
  ) {}

  // ─── Payments ────────────────────────────────────────

  async createPayment(req: HttpRequest) {
    this.logger.info('POST /api/payments')
    const data = validateSchema(CreatePaymentSchema, req.body) as unknown as CreatePaymentDTO
    const payment = await this.service.createPayment(data)
    return { status: 201, body: payment }
  }

  async chargeCard(req: HttpRequest) {
    this.logger.info('POST /api/payments/charge')
    const data = validateSchema(ChargeCardSchema, req.body) as unknown as ChargeCardDTO
    const result = await this.service.chargeCard(data)
    return { status: 200, body: result }
  }

  async refund(req: HttpRequest) {
    this.logger.info('POST /api/payments/:id/refund')
    const { id } = req.params
    const { amount } = req.body as { amount?: number }
    const payment = await this.service.refundPayment(id, amount)
    return { status: 200, body: payment }
  }

  async getPayment(req: HttpRequest) {
    this.logger.info('GET /api/payments/:id')
    const payment = await this.service.getPayment(req.params.id)
    return { status: 200, body: payment }
  }

  async listPayments(req: HttpRequest) {
    this.logger.info('GET /api/payments')
    const query = req.query as unknown as PaymentsQuery
    const result = await this.service.listPayments(query)
    return { status: 200, body: result }
  }

  async handleWebhook(req: HttpRequest) {
    this.logger.info('POST /api/webhooks/stripe')
    const signature = (req as any).headers?.['stripe-signature'] || ''
    const payload = (req as any).rawBody || Buffer.from(JSON.stringify(req.body))
    const result = await this.service.handleStripeWebhook(payload, signature)
    return { status: 200, body: result }
  }

  // ─── Payment Links ───────────────────────────────────

  async createLink(req: HttpRequest) {
    this.logger.info('POST /api/payment-links')
    const data = validateSchema(CreatePaymentLinkSchema, req.body) as unknown as CreatePaymentLinkDTO
    const link = await this.service.createPaymentLink(data)
    return { status: 201, body: link }
  }

  async getLinkByToken(req: HttpRequest) {
    this.logger.info('GET /api/payment-links/:token')
    const link = await this.service.getPaymentLinkByToken(req.params.token)
    return { status: 200, body: link }
  }

  async cancelLink(req: HttpRequest) {
    this.logger.info('DELETE /api/payment-links/:id')
    await this.service.cancelPaymentLink(req.params.id)
    return { status: 204, body: null }
  }

  async listLinks(req: HttpRequest) {
    this.logger.info('GET /api/payment-links')
    const hotelId = (req as any).hotelId || req.query.hotelId
    const links = await this.service.listPaymentLinks(hotelId)
    return { status: 200, body: links }
  }

  // ─── Deposits ────────────────────────────────────────

  async createDeposit(req: HttpRequest) {
    this.logger.info('POST /api/deposits')
    const data = validateSchema(CreateDepositSchema, req.body) as unknown as CreateDepositDTO
    const deposit = await this.service.createDeposit(data)
    return { status: 201, body: deposit }
  }

  async refundDeposit(req: HttpRequest) {
    this.logger.info('POST /api/deposits/:id/refund')
    const { id } = req.params
    const data = validateSchema(RefundDepositSchema, req.body) as unknown as RefundDepositDTO
    const deposit = await this.service.refundDeposit(id, data)
    return { status: 200, body: deposit }
  }

  async releaseDeposit(req: HttpRequest) {
    this.logger.info('POST /api/deposits/:id/release')
    const deposit = await this.service.releaseDeposit(req.params.id)
    return { status: 200, body: deposit }
  }

  async listDeposits(req: HttpRequest) {
    this.logger.info('GET /api/deposits')
    const hotelId = (req as any).hotelId || req.query.hotelId
    const { status } = req.query as { status?: string }
    const deposits = await this.service.listDeposits(hotelId, status)
    return { status: 200, body: deposits }
  }

  async getDeposit(req: HttpRequest) {
    this.logger.info('GET /api/deposits/:id')
    const deposit = await this.service.getDeposit(req.params.id)
    return { status: 200, body: deposit }
  }

  // ─── Reconciliation ──────────────────────────────────

  async reconcile(req: HttpRequest) {
    this.logger.info('POST /api/billing/reconciliation')
    const hotelId = (req as any).hotelId
    const { entries, from, to } = req.body as { entries: ReconciliationEntry[]; from?: string; to?: string }
    const result = await this.service.reconcile(hotelId, entries, from, to)
    return { status: 200, body: result }
  }
}
