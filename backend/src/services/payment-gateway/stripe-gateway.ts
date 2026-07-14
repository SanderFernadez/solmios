// services/payment-gateway/stripe-gateway.ts — Adapter de Stripe sobre el puerto PaymentGateway.
//
// Reemplaza a las DOS clases StripeUseCase duplicadas (payments y bookingengine), que además
// usaban apiVersions distintas de Stripe. Una sola implementación, una sola apiVersion.

import Stripe from 'stripe'
import type {
  ChargeRequest, ChargeResult, ConfirmContext, GatewayCapabilities, GatewayMode,
  PaymentOutcome, PaymentProvider, RefundResult, RefundableGateway,
} from './types'

/** Una sola apiVersion para todo el sistema (antes: 2026-05-27.dahlia vs 2025-08-27.basil). */
const STRIPE_API_VERSION = '2025-08-27.basil'

export interface StripeCredentials {
  secretKey: string
  publishableKey?: string
  webhookSecret?: string
  currency?: string
}

export class StripeGateway implements RefundableGateway {
  readonly provider: PaymentProvider = 'stripe'
  readonly capabilities: GatewayCapabilities = {
    refund: true,
    void: true,
    paymentLinks: true,
    confirmation: 'push', // webhook firmado (HMAC sobre el body crudo)
  }

  private readonly stripe: Stripe

  constructor(
    private readonly creds: StripeCredentials,
    readonly mode: GatewayMode,
  ) {
    if (!creds.secretKey) throw new Error('Stripe: falta secretKey')
    this.stripe = new Stripe(creds.secretKey, {
      // El tipo de apiVersion está clavado a la versión del SDK; fijamos la nuestra a propósito.
      apiVersion: STRIPE_API_VERSION as any,
      appInfo: { name: 'SolmiOS', version: '1.0.0' },
    })
  }

  async createCharge(req: ChargeRequest): Promise<ChargeResult> {
    try {
      const session = await this.stripe.checkout.sessions.create({
        mode: 'payment',
        payment_method_types: ['card'],
        line_items: [{
          price_data: {
            currency: (req.currency || this.creds.currency || 'usd').toLowerCase(),
            product_data: { name: req.description },
            // amountMinor YA viene en centavos: no multiplicar de nuevo.
            unit_amount: req.amountMinor,
          },
          quantity: 1,
        }],
        success_url: req.successUrl,
        cancel_url: req.cancelUrl,
        customer_email: req.customerEmail,
        client_reference_id: req.reference,
        metadata: { reference: req.reference, hotelId: req.hotelId, ...(req.metadata || {}) },
      })
      if (!session.url) return { status: 'failed', reason: 'Stripe no devolvió URL de checkout' }
      return { status: 'redirect', redirectUrl: session.url, providerRef: session.id }
    } catch (e: any) {
      return { status: 'failed', reason: e?.message || 'Stripe rechazó el cobro' }
    }
  }

  /**
   * Verifica la firma del webhook contra el secreto DE ESTE HOTEL y traduce el evento.
   * Devuelve null si la firma no valida: un evento no autenticado no puede mover dinero.
   *
   * Requiere los bytes CRUDOS. `JSON.stringify(body)` no reproduce la firma (orden de claves,
   * espacios, unicode) — de ahí que el webhook devolviera 400 a todo evento mientras el
   * framework descartaba el rawBody.
   */
  async confirm(ctx: ConfirmContext): Promise<PaymentOutcome | null> {
    const signature = ctx.headers?.['stripe-signature']
    if (!signature) return null
    if (!this.creds.webhookSecret) {
      throw new Error('Stripe: falta webhookSecret para verificar la firma del webhook')
    }
    if (!ctx.rawBody) {
      throw new Error(
        'Stripe: no hay rawBody. La firma se calcula sobre los bytes crudos y el framework ' +
        'los descarta al parsear el JSON (ver PG-0). Sin esto la firma NUNCA valida.',
      )
    }

    let event: Stripe.Event
    try {
      // `constructEventAsync`, NO `constructEvent`: bajo Bun el sincrónico lanza
      // "SubtleCryptoProvider cannot be used in a synchronous context" y rechaza TODO evento.
      event = await this.stripe.webhooks.constructEventAsync(ctx.rawBody, signature, this.creds.webhookSecret)
    } catch {
      return null // firma inválida → impostor
    }

    const obj = event.data.object as any
    const status = this.mapStatus(event.type, obj)
    if (!status) return null // evento que no nos interesa

    return {
      eventId: event.id,
      providerRef: obj.id,
      status,
      amountMinor: Number(obj.amount_total ?? obj.amount ?? 0),
      currency: String(obj.currency ?? this.creds.currency ?? 'usd'),
      reference: String(obj.client_reference_id ?? obj.metadata?.reference ?? ''),
      raw: event,
    }
  }

  private mapStatus(type: string, obj: any): PaymentOutcome['status'] | null {
    switch (type) {
      case 'checkout.session.completed':
        return obj.payment_status === 'paid' ? 'paid' : 'pending'
      case 'payment_intent.succeeded':
        return 'paid'
      case 'payment_intent.payment_failed':
        return 'failed'
      case 'charge.refunded':
      case 'refund.created':
        return 'refunded'
      default:
        return null
    }
  }

  async refund(providerRef: string, amountMinor?: number): Promise<RefundResult> {
    const r = await this.stripe.refunds.create({
      payment_intent: providerRef,
      ...(amountMinor ? { amount: amountMinor } : {}),
    })
    return { refundId: r.id, status: r.status || 'unknown' }
  }

  async voidCharge(providerRef: string): Promise<void> {
    await this.stripe.paymentIntents.cancel(providerRef)
  }

  /** Link de pago reutilizable. Capacidad propia de Stripe: Azul y CardNet no la tienen. */
  async createPaymentLink(params: {
    amountMinor: number
    currency: string
    description: string
  }): Promise<{ id: string; url: string }> {
    const link = await this.stripe.paymentLinks.create({
      line_items: [{
        price_data: {
          currency: (params.currency || this.creds.currency || 'usd').toLowerCase(),
          product_data: { name: params.description },
          unit_amount: params.amountMinor,
        },
        quantity: 1,
      }] as any,
    })
    return { id: link.id, url: link.url }
  }

  /**
   * Golpea la API para validar las credenciales de verdad. Que una llave se haya guardado no
   * significa que sirva: puede estar revocada, ser de otra cuenta, o tener el prefijo cambiado.
   */
  async retrieveAccount(): Promise<{ id: string; name?: string }> {
    // Sin argumentos devuelve la cuenta dueña de la API key (el typing pide un id, la API no).
    const acct: any = await (this.stripe.accounts as any).retrieve()
    return {
      id: String(acct?.id ?? ''),
      name: acct?.settings?.dashboard?.display_name || acct?.business_profile?.name || undefined,
    }
  }

  /** Consulta puntual de una sesión (reconciliación / fallback si el webhook no llegó). */
  async getSession(sessionId: string): Promise<Stripe.Checkout.Session | null> {
    try {
      return await this.stripe.checkout.sessions.retrieve(sessionId)
    } catch {
      return null
    }
  }
}
