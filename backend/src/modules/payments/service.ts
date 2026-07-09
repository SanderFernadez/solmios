// payments/service.ts — Facade pública del módulo Payments
// Orquestador delgado que delega a usecases/

import type { RepositoryAdapter, Logger, CacheAdapter, Auth } from 'arckode-framework'
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
import { refundPayment } from './usecases/refund'

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
    private readonly auth?: any,
    userRepo?: RepositoryAdapter<any>,
  ) {
    this.stripe = new StripeUseCase(logger)
    this.crud = new PaymentCrudUseCase(paymentRepo, logger, auth, userRepo)
    this.links = new PaymentLinksUseCase(linkRepo, auth, userRepo)
    this.deposits = new DepositsUseCase(depositRepo, logger, auth, userRepo)
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

  async refundPayment(paymentId: string, amount?: number, user?: { id?: string; role?: string }): Promise<PaymentDTO> {
    return refundPayment(
      { crud: this.crud, stripe: this.stripe, createPayment: (dto) => this.createPayment(dto) },
      paymentId, amount, user,
    )
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

  async getPayment(id: string, user?: { id?: string; role?: string }): Promise<PaymentDTO> {
    return this.crud.getById(id, user?.id, user?.role)
  }

  async listPayments(query: PaymentsQuery): Promise<PaymentsPaginated> {
    return this.crud.list(query)
  }

  /** Asiento de un cobro Stripe, si ya existe. Lo usa el conector payment-requests-payments. */
  async findByStripeSession(hotelId: string, stripeSessionId: string): Promise<PaymentDTO | null> {
    return this.crud.findByStripeSession(hotelId, stripeSessionId)
  }

  // ─── Payment Links ───────────────────────────────────

  async createPaymentLink(dto: CreatePaymentLinkDTO): Promise<PaymentLinkDTO> {
    return this.links.create(dto)
  }

  async getPaymentLinkByToken(token: string): Promise<PaymentLinkDTO> {
    return this.links.getByToken(token)
  }

  async cancelPaymentLink(id: string, user?: { id?: string; role?: string }): Promise<void> {
    return this.links.cancel(id, user?.id, user?.role)
  }

  async listPaymentLinks(hotelId: string): Promise<PaymentLinkDTO[]> {
    return this.links.list(hotelId)
  }

  // ─── Deposits ────────────────────────────────────────

  async createDeposit(dto: CreateDepositDTO): Promise<DepositDTO> {
    return this.deposits.create(dto)
  }

  async refundDeposit(id: string, dto: RefundDepositDTO, user?: { id?: string; role?: string }): Promise<DepositDTO> {
    return this.deposits.refund(id, dto, user?.id, user?.role)
  }

  async releaseDeposit(id: string, user?: { id?: string; role?: string }): Promise<DepositDTO> {
    return this.deposits.release(id, user?.id, user?.role)
  }

  async listDeposits(hotelId: string, status?: string): Promise<DepositDTO[]> {
    return this.deposits.list(hotelId, status)
  }

  async getDeposit(id: string, user?: { id?: string; role?: string }): Promise<DepositDTO> {
    return this.deposits.getById(id, user?.id, user?.role)
  }

  // ─── Reconciliation ──────────────────────────────────

  async reconcile(hotelId: string, bankEntries?: ReconciliationEntry[], from?: string, to?: string): Promise<ReconciliationResult> {
    return this.reconciliation.reconcile(hotelId, bankEntries, from, to)
  }
}
