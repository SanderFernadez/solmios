// payments/service.ts — Facade pública del módulo Payments
// Orquestador delgado que delega a usecases/

import type { RepositoryAdapter, Logger, CacheAdapter } from 'arckode-framework'
import { ValidationError } from 'arckode-framework'
import type {
  PaymentDTO, CreatePaymentDTO, ChargeCardDTO,
  PaymentLinkDTO, CreatePaymentLinkDTO,
  DepositDTO, CreateDepositDTO, RefundDepositDTO,
  PaymentsQuery, PaymentsPaginated,
  ReconciliationEntry, ReconciliationResult,
} from './types'
import type { PaymentsSockets } from './sockets'
import { StripeUseCase } from './usecases/stripe'
import { PaymentCrudUseCase } from './usecases/payment-crud'
import { PaymentLinksUseCase } from './usecases/payment-links'
import { DepositsUseCase } from './usecases/deposits'
import { ReconciliationUseCase } from './usecases/reconciliation'

export class PaymentsService {
  private sockets: PaymentsSockets = {}
  private stripe: StripeUseCase
  private crud: PaymentCrudUseCase
  private links: PaymentLinksUseCase
  private deposits: DepositsUseCase
  private reconciliation: ReconciliationUseCase

  constructor(
    paymentRepo: RepositoryAdapter<PaymentDTO>,
    linkRepo: RepositoryAdapter<PaymentLinkDTO>,
    depositRepo: RepositoryAdapter<DepositDTO>,
    private readonly logger: Logger,
    cache: CacheAdapter,
  ) {
    this.stripe = new StripeUseCase(logger)
    this.crud = new PaymentCrudUseCase(paymentRepo, logger)
    this.links = new PaymentLinksUseCase(linkRepo)
    this.deposits = new DepositsUseCase(depositRepo, logger)
    this.reconciliation = new ReconciliationUseCase(paymentRepo)
  }

  setSockets(s: Partial<PaymentsSockets>): void {
    const next = s as Record<string, any>
    const cur = this.sockets as Record<string, any>
    for (const key of Object.keys(next)) {
      const h = next[key]
      if (!h) continue
      const prev = cur[key]
      cur[key] = prev ? async (...a: any[]) => { await prev(...a); await h(...a) } : h
    }
  }

  async initStripe(secretKey: string, webhookSecret: string): Promise<void> {
    await this.stripe.initialize(secretKey, webhookSecret)
  }

  // ─── Payments ────────────────────────────────────────

  async createPayment(dto: CreatePaymentDTO): Promise<PaymentDTO> {
    const payment = await this.crud.create(dto)
    await this.sockets.onPaymentCreated?.(payment)
    // V8: los pagos cash se crean con status='completed' (payment-crud.ts). Emitimos onPaymentCompleted
    // para que el conector payments→caja registre el ingreso en caja. Los pagos card van por webhook Stripe.
    if (payment.status === 'completed') await this.sockets.onPaymentCompleted?.(payment)
    return payment
  }

  async chargeCard(dto: ChargeCardDTO): Promise<{ payment: PaymentDTO; checkoutUrl: string }> {
    const payment = await this.createPayment({
      hotelId: dto.hotelId,
      type: 'charge',
      method: 'card',
      amount: dto.amount,
      currency: dto.currency,
      description: dto.description,
      folioId: dto.folioId,
      guestId: dto.guestId,
    })

    if (!this.stripe.isConfigured()) {
      throw new ValidationError('Stripe not configured - use cash or transfer method')
    }

    const session = await this.stripe.createCheckoutSession({
      amount: dto.amount,
      currency: dto.currency ?? 'USD',
      description: dto.description,
      metadata: { paymentId: payment.id, hotelId: dto.hotelId },
      successUrl: dto.successUrl,
      cancelUrl: dto.cancelUrl,
    })

    await this.crud.updateStatus(payment.id, 'processing')

    return { payment, checkoutUrl: session.url }
  }

  async refundPayment(paymentId: string, amount?: number): Promise<PaymentDTO> {
    const payment = await this.crud.getById(paymentId)
    if (payment.status !== 'completed') throw new ValidationError('Payment not completed')
    if (payment.method !== 'card') throw new ValidationError('Only card payments can be refunded via Stripe')

    if (!this.stripe.isConfigured()) throw new ValidationError('Stripe not configured')

    const refund = await this.stripe.refund({ paymentId: payment.stripePaymentId, amount })

    const refundPayment = await this.createPayment({
      hotelId: payment.hotelId,
      type: 'refund',
      method: 'card',
      amount: amount ?? payment.amount,
      currency: payment.currency,
      description: `Refund for payment ${paymentId}`,
      reference: refund.id,
      folioId: payment.folioId,
      guestId: payment.guestId,
    })

    if (!amount || amount >= payment.amount) {
      await this.crud.updateStatus(paymentId, 'refunded')
    }

    return refundPayment
  }

  async handleStripeWebhook(payload: Buffer, signature: string): Promise<{ type: string; paymentId?: string }> {
    const { type, data } = await this.stripe.handleWebhook(payload, signature)

    if (type === 'checkout.session.completed') {
      const paymentId = data.metadata?.paymentId
      if (paymentId) {
        await this.crud.updateStatus(paymentId, 'completed', data.payment_intent || '')
        const payment = await this.crud.getById(paymentId)
        await this.sockets.onPaymentCompleted?.(payment)
        return { type: 'payment_completed', paymentId }
      }
    }

    return { type }
  }

  async getPayment(id: string): Promise<PaymentDTO> {
    return this.crud.getById(id)
  }

  async listPayments(query: PaymentsQuery): Promise<PaymentsPaginated> {
    return this.crud.list(query)
  }

  // ─── Payment Links ───────────────────────────────────

  async createPaymentLink(dto: CreatePaymentLinkDTO): Promise<PaymentLinkDTO> {
    return this.links.create(dto)
  }

  async getPaymentLinkByToken(token: string): Promise<PaymentLinkDTO> {
    return this.links.getByToken(token)
  }

  async cancelPaymentLink(id: string): Promise<void> {
    return this.links.cancel(id)
  }

  async listPaymentLinks(hotelId: string): Promise<PaymentLinkDTO[]> {
    return this.links.list(hotelId)
  }

  // ─── Deposits ────────────────────────────────────────

  async createDeposit(dto: CreateDepositDTO): Promise<DepositDTO> {
    return this.deposits.create(dto)
  }

  async refundDeposit(id: string, dto: RefundDepositDTO): Promise<DepositDTO> {
    return this.deposits.refund(id, dto)
  }

  async releaseDeposit(id: string): Promise<DepositDTO> {
    return this.deposits.release(id)
  }

  async listDeposits(hotelId: string, status?: string): Promise<DepositDTO[]> {
    return this.deposits.list(hotelId, status)
  }

  async getDeposit(id: string): Promise<DepositDTO> {
    return this.deposits.getById(id)
  }

  // ─── Reconciliation ──────────────────────────────────

  async reconcile(hotelId: string, bankEntries: ReconciliationEntry[], from?: string, to?: string): Promise<ReconciliationResult> {
    return this.reconciliation.reconcile(hotelId, bankEntries, from, to)
  }
}
