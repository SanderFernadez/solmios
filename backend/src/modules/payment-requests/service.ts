// payment-requests/service.ts — Facade del módulo.
// CRUD de PaymentRequests + integración Stripe (status, checkout, webhook).
// hotelId forzado del JWT en create; assertOwnership en update/delete (P0 IDOR CR-25/26).
//
// El asiento del dinero ya sale por el puerto `StripePaymentPort` → módulo `payments`
// (conector `payment-requests-payments`), así el cobro entra a la conciliación bancaria.
//
// DEUDA F10 (parcial): handleWebhook todavía aplica el pago a Reservations + FolioCharges
// accediendo a esas tablas vía repos cross-table. El patrón canónico sería emitir
// onPaymentRequestPaid y que un conector aplique el pago sobre los módulos dueños.

import type { RepositoryAdapter, Logger, Auth } from 'arckode-framework'
import { NotFoundError } from 'arckode-framework'
import { StripeService } from '../../services/stripe-service'
import type {
  PaymentRequestDTO, CreatePaymentRequestDTO, UpdatePaymentRequestDTO,
  PaymentRequestQuery, CurrentUser, StripeStatusResult, CheckoutResult, WebhookResult,
} from './types'
import type { PaymentRequestsSockets } from './sockets'
import { processStripeWebhook } from './usecases/stripe-webhook'
import type { StripePaymentPort } from './usecases/payment-port'
import {
  auditSafely, deleteEntry, statusChangeEntry, isSensitiveStatus,
  type AuditEntry, type AuditPort,
} from './usecases/audit'

/** Puerto por defecto para el fallback de URLs de checkout en dev (sin header Origin). */
const DEFAULT_PORT = 3000

export class PaymentRequestsService {
  private sockets: PaymentRequestsSockets = {}
  private paymentPort: StripePaymentPort | null = null
  private auditPort: AuditPort | null = null

  constructor(
    private readonly repo: RepositoryAdapter<PaymentRequestDTO>,
    private readonly reservationRepo: RepositoryAdapter<any>,
    private readonly folioRepo: RepositoryAdapter<any>,
    private readonly folioChargeRepo: RepositoryAdapter<any>,
    private readonly userRepo: RepositoryAdapter<any>,
    private readonly logger: Logger,
    private readonly auth: Auth,
  ) {}

  setSockets(s: Partial<PaymentRequestsSockets>): void {
    const next = s as Record<string, any>; const cur = this.sockets as Record<string, any>
    for (const key of Object.keys(next)) {
      const h = next[key]; if (!h) continue
      const prev = cur[key]
      cur[key] = prev ? async (...a: any[]) => { await prev(...a); await h(...a) } : h
    }
  }

  /** Inyectado por el conector `payment-requests-payments`. Sin él, el cobro no se asienta. */
  setPaymentDeps(deps: { paymentPort: StripePaymentPort }): void {
    this.paymentPort = deps.paymentPort
  }

  /** Conecta el audit log. Lo inyecta el connector `payment-requests-auditlog`. */
  setAuditDeps(port: AuditPort): void {
    this.auditPort = port
  }

  private audit(entry: AuditEntry): Promise<void> {
    return auditSafely(this.auditPort, this.logger, entry)
  }

  /** super_admin puede especificar hotelId; resto usa el del JWT. */
  private hotelOfUser(user: CurrentUser, dtoHotelId?: string): string {
    if (user.role === 'super_admin') return dtoHotelId || user.hotelId || ''
    return user.hotelId || ''
  }

  private async assertOwned(id: string, user: CurrentUser): Promise<PaymentRequestDTO> {
    const item = await this.repo.findById(id)
    if (!item) throw new NotFoundError('Payment request no encontrado')
    const me = await this.userRepo.findById(user.id)
    this.auth.assertOwnership(item.hotelId, (me as any)?.hotelId ?? '', user.role, 'super_admin')
    return item
  }

  // ─── CRUD ──────────────────────────────────────────────

  async list(query: PaymentRequestQuery, user: CurrentUser): Promise<{ data: PaymentRequestDTO[] }> {
    const hotelId = this.hotelOfUser(user, query.hotelId)
    const filters: Record<string, unknown> = { hotelId: hotelId || '__none__' }
    if (query.reservationId) filters.reservationId = query.reservationId
    const data = await this.repo.findMany(filters)
    return { data }
  }

  async getById(id: string, user: CurrentUser): Promise<PaymentRequestDTO> {
    return this.assertOwned(id, user)
  }

  async create(dto: CreatePaymentRequestDTO, user: CurrentUser): Promise<PaymentRequestDTO> {
    const hotelId = this.hotelOfUser(user, dto.hotelId)
    const item = await this.repo.create({
      hotelId,
      reservationId: dto.reservationId,
      amount: Number(dto.amount),
      currency: dto.currency || 'USD',
      status: 'pending',
      sentTo: dto.sentTo || '',
      sentVia: dto.sentVia || 'email',
    } as Omit<PaymentRequestDTO, 'id'>)
    await this.sockets.onPaymentRequestCreated?.(item)
    return item
  }

  async update(id: string, dto: UpdatePaymentRequestDTO, user: CurrentUser): Promise<PaymentRequestDTO> {
    const previous = await this.assertOwned(id, user) // IDOR CR-26: ownership antes de mutar
    const patch: Partial<PaymentRequestDTO> = {}
    for (const k of ['amount', 'status', 'stripeSessionId', 'stripePaymentUrl', 'sentTo', 'sentVia', 'paidAt'] as (keyof UpdatePaymentRequestDTO)[]) {
      if (dto[k] !== undefined) (patch as any)[k] = dto[k]
    }
    const item = await this.repo.update(id, patch)
    if (!item) throw new NotFoundError('Payment request no encontrado')
    await this.sockets.onPaymentRequestUpdated?.(item)
    // Marcar "paid"/"cancelled" a mano perdona una deuda sin que Stripe cobre nada: necesita rastro.
    if (isSensitiveStatus(dto.status) && dto.status !== previous.status) {
      await this.audit(statusChangeEntry(item, previous.status, user))
    }
    return item
  }

  async delete(id: string, user: CurrentUser): Promise<void> {
    const existing = await this.assertOwned(id, user) // IDOR CR-25: ownership antes de borrar
    const deleted = await this.repo.delete(id)
    if (!deleted) throw new NotFoundError('Payment request no encontrado')
    await this.sockets.onPaymentRequestDeleted?.(id)
    await this.audit(deleteEntry(existing, user))
  }

  // ─── Stripe ────────────────────────────────────────────

  async stripeStatus(user: CurrentUser): Promise<StripeStatusResult> {
    const hotelId = this.hotelOfUser(user)
    const cfg = await StripeService.getConfig(hotelId)
    return {
      configured: !!cfg.secretKey,
      publishableKey: cfg.publishableKey || '',
      currency: cfg.currency || 'usd',
    }
  }

  async createCheckout(id: string, user: CurrentUser, origin: string): Promise<CheckoutResult | { status: number; body: any }> {
    const hotelId = this.hotelOfUser(user)
    if (!(await StripeService.isConfigured(hotelId))) {
      return { status: 503, body: { error: 'Stripe no configurado', hint: 'Configurá las keys en Settings > Conectar Stripe o en .env' } }
    }
    const pr = await this.assertOwned(id, user)
    if (pr.status === 'paid') return { status: 400, body: { error: 'Ya está pagado' } }

    const fallbackOrigin = `http://localhost:${process.env.PORT || DEFAULT_PORT}`
    const guestEmail = pr.sentTo?.includes('@') ? pr.sentTo : undefined
    try {
      const result = await StripeService.createCheckoutSession({
        hotelId,
        paymentRequestId: id,
        amount: Number(pr.amount),
        currency: pr.currency || 'usd',
        description: `Reserva ${String(pr.reservationId || '').slice(0, 8)}`,
        successUrl: `${origin || fallbackOrigin}/panel/payments?status=paid&id=${id}`,
        cancelUrl: `${origin || fallbackOrigin}/panel/payments?status=cancelled&id=${id}`,
        customerEmail: guestEmail,
        metadata: { hotelId: pr.hotelId, reservationId: pr.reservationId || '' },
      })
      await this.repo.update(id, { stripeSessionId: result.sessionId, stripePaymentUrl: result.sessionUrl } as Partial<PaymentRequestDTO>)
      return { url: result.sessionUrl, sessionId: result.sessionId }
    } catch (e: any) {
      this.logger.error('Stripe create checkout failed', e)
      return { status: 500, body: { error: 'Error al crear sesión de pago', detail: e.message } }
    }
  }

  /**
   * Webhook público Stripe. El hotel viene en la RUTA: su secreto de firma es lo que autentica
   * el mensaje, así que hay que saber de quién es antes de creerle al body.
   */
  async handleWebhook(hotelId: string, rawBody: string | Buffer, signature: string): Promise<WebhookResult> {
    return processStripeWebhook(
      {
        repo: this.repo, reservationRepo: this.reservationRepo,
        folioRepo: this.folioRepo, folioChargeRepo: this.folioChargeRepo,
        logger: this.logger, sockets: this.sockets, paymentPort: this.paymentPort,
        audit: (entry) => this.audit(entry),
      },
      hotelId, rawBody, signature,
    )
  }
}
