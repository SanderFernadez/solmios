// payments/service.ts — Facade pública del módulo Payments
// Orquestador delgado que delega a usecases/

import type { RepositoryAdapter, Logger, CacheAdapter, Auth } from 'arckode-framework'
import type {
  PaymentDTO, CreatePaymentDTO, ChargeCardDTO,
  PaymentLinkDTO, CreatePaymentLinkDTO,
  DepositDTO, CreateDepositDTO, RefundDepositDTO,
  PaymentsQuery, PaymentsPaginated,
  ReconciliationEntry, ReconciliationResult,
} from './types'
import type { PaymentsSockets } from './sockets'
import { StripeUseCase } from './usecases/stripe'
import type { PaymentGatewayRegistry } from '../../services/payment-gateway/registry'
import type { PaymentEventStore } from '../../services/payment-gateway/payment-events'
import { PaymentCrudUseCase } from './usecases/payment-crud'
import { PaymentLinksUseCase } from './usecases/payment-links'
import { DepositsUseCase } from './usecases/deposits'
import { ReconciliationUseCase } from './usecases/reconciliation'
import { refundPayment } from './usecases/refund'
import { chargeCard } from './usecases/charge-card'
import { settleStripeWebhook } from './usecases/settle-webhook'
import {
  auditSafely, chargeEntry, refundEntry,
  depositRefundEntry, depositReleaseEntry,
  type AuditEntry, type AuditPort, type Actor,
} from './usecases/audit'

export class PaymentsService {
  private sockets: PaymentsSockets = {}
  private stripe: StripeUseCase
  private crud: PaymentCrudUseCase
  private links: PaymentLinksUseCase
  private deposits: DepositsUseCase
  private reconciliation: ReconciliationUseCase
  private auditPort: AuditPort | null = null

  constructor(
    paymentRepo: RepositoryAdapter<PaymentDTO>,
    linkRepo: RepositoryAdapter<PaymentLinkDTO>,
    depositRepo: RepositoryAdapter<DepositDTO>,
    private readonly logger: Logger,
    cache: CacheAdapter,
    private readonly auth?: any,
    userRepo?: RepositoryAdapter<any>,
    registry?: PaymentGatewayRegistry,
    private readonly events?: PaymentEventStore,
  ) {
    if (!registry) throw new Error('payments: PaymentGatewayRegistry es requerido (pasarela por hotel)')
    this.stripe = new StripeUseCase(registry, logger)
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

  /** Conecta el audit log. Lo inyecta el connector `payments-auditlog`. */
  setAuditDeps(port: AuditPort): void {
    this.auditPort = port
  }

  private audit(entry: AuditEntry): Promise<void> {
    return auditSafely(this.auditPort, this.logger, entry)
  }

  // initStripe() eliminado: inicializaba UNA cuenta global desde process.env para todos los
  // hoteles. Ahora la pasarela se resuelve por hotel en cada operación (ver StripeUseCase).

  // ─── Payments ────────────────────────────────────────

  async createPayment(dto: CreatePaymentDTO): Promise<PaymentDTO> {
    const payment = await this.crud.create(dto)
    await this.sockets.onPaymentCreated?.(payment)
    if (payment.status === 'completed') await this.sockets.onPaymentCompleted?.(payment)
    return payment
  }

  async chargeCard(dto: ChargeCardDTO, actor?: Actor): Promise<{ payment: PaymentDTO; checkoutUrl: string }> {
    const result = await chargeCard(
      { stripe: this.stripe, crud: this.crud, createPayment: (d) => this.createPayment(d) },
      dto,
    )
    await this.audit(chargeEntry(result.payment, actor))
    return result
  }

  async refundPayment(paymentId: string, amount?: number, user?: { id?: string; role?: string }): Promise<PaymentDTO> {
    const refunded = await refundPayment(
      { crud: this.crud, stripe: this.stripe, createPayment: (dto) => this.createPayment(dto) },
      paymentId, amount, user,
    )
    await this.audit(refundEntry(refunded, amount, user))
    return refunded
  }

  /** Asienta un cobro confirmado por webhook, una sola vez (idempotencia en el usecase). */
  async handleStripeWebhook(
    hotelId: string,
    payload: Buffer | string,
    signature: string,
  ): Promise<{ type: string; paymentId?: string } | null> {
    if (!this.events) throw new Error('payments: PaymentEventStore es requerido para procesar webhooks')
    return settleStripeWebhook(
      { stripe: this.stripe, crud: this.crud, events: this.events,
        audit: (e) => this.audit(e), onCompleted: (p) => this.sockets.onPaymentCompleted?.(p) ?? Promise.resolve() },
      hotelId, payload, signature,
    )
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
    const deposit = await this.deposits.refund(id, dto, user?.id, user?.role)
    await this.audit(depositRefundEntry(deposit, user))
    return deposit
  }

  async releaseDeposit(id: string, user?: { id?: string; role?: string }): Promise<DepositDTO> {
    const deposit = await this.deposits.release(id, user?.id, user?.role)
    await this.audit(depositReleaseEntry(deposit, user))
    return deposit
  }

  /** Libera los depósitos 'held' de una reserva al checkout (connector `reservas-deposits`).
   *  La lógica vive en `DepositsUseCase.releaseHeldByReservation`; acá solo auditamos cada release. */
  async releaseHeldDepositsByReservation(reservationId: string, user?: { id?: string; role?: string }): Promise<DepositDTO[]> {
    return this.deposits.releaseHeldByReservation(reservationId, (d) => this.audit(depositReleaseEntry(d, user)))
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
