// services/payment-gateway/cardnet-gateway.ts — Adapter de CardNet (Ztrans), pasarela dominicana.
//
// ⚠️ A SPEC — SIN VERIFICAR CONTRA SANDBOX REAL. No hay credenciales de comercio de CardNet ni
// acceso a su documentación oficial de integración. Los NOMBRES DE CAMPO, el host/endpoint de
// consulta y el algoritmo de firma de este archivo son una implementación PLAUSIBLE basada en el
// patrón típico de pasarelas dominicanas de "hosted page + consulta activa" (redirect firmado +
// status query firmado). CONFIRMAR contra el manual de integración real de CardNet Ztrans antes de
// ir a producción — no se puede probar end-to-end sin credenciales.
//
// CardNet no tiene webhook (`capabilities.confirmation === 'pull'`): el navegador vuelve con una
// referencia, pero eso NO es prueba de pago — hay que ir a preguntarle activamente a CardNet si
// esa transacción se aprobó (mismo motivo por el que Azul Webservices/CardNet no confían en el
// retorno solo).

import { createHash } from 'node:crypto'
import type {
  ChargeRequest, ChargeResult, ConfirmContext, GatewayCapabilities, GatewayMode,
  PaymentOutcome, PaymentProvider, RefundResult, RefundableGateway,
} from './types'

export interface CardnetCredentials {
  /** Código de comercio (Merchant/Comercio) asignado por CardNet. */
  comercio: string
  /** Terminal asignada dentro del comercio. */
  terminal: string
  /** Llave secreta para firmar el request de cobro y la consulta de estado. */
  llave: string
  currency?: string
}

/**
 * Traduce el JSON genérico de `payment_gateways.credentials` (secretKey/merchantId/terminalId,
 * mismo shape que Stripe/Azul — ver usecases/build-credentials.ts) al shape propio de CardNet.
 * Centralizado acá para que `registry.ts` y el usecase de `testConnection` no dupliquen el mapeo.
 */
export function toCardnetCredentials(stored: Record<string, unknown>): CardnetCredentials {
  return {
    comercio: String(stored.merchantId || ''),
    terminal: String(stored.terminalId || ''),
    llave: String(stored.secretKey || ''), // "llave secreta" genérica = Llave de CardNet
    currency: stored.currency ? String(stored.currency) : undefined,
  }
}

/** A SPEC — confirmar los hosts reales de Ztrans contra el manual de CardNet. */
const CARDNET_HOST: Record<GatewayMode, string> = {
  test: 'https://qacardnet.cardnet.com.do',
  live: 'https://ecommerce.cardnet.com.do',
}

export interface CardnetChargeFields {
  Comercio: string
  Terminal: string
  /** Nuestra referencia (reservation/folio/payment request) — la usamos como token de transacción. */
  TrxToken: string
  /** Entero en unidades menores (centavos), como string. */
  Monto: string
  Moneda: string
  ReturnUrl: string
}

/** Firma del request de ida: SHA-512 hex de los campos + llave. A SPEC — confirmar orden real. */
export function signChargeRequest(fields: CardnetChargeFields, llave: string): string {
  const concat = [fields.Comercio, fields.Terminal, fields.TrxToken, fields.Monto, fields.Moneda, llave].join('|')
  return createHash('sha512').update(concat, 'utf8').digest('hex')
}

export interface CardnetStatusResponse {
  TrxToken: string
  /** '00' = aprobado (convención tipo ISO 8583). A SPEC — confirmar códigos reales. */
  ResponseCode: string
  AuthorizationCode?: string
  Rrn?: string
  Monto?: string
  Moneda?: string
}

/** Firma de la consulta de estado — misma fórmula defensiva que el request de ida. A SPEC. */
export function signStatusQuery(comercio: string, terminal: string, trxToken: string, llave: string): string {
  return createHash('sha512').update([comercio, terminal, trxToken, llave].join('|'), 'utf8').digest('hex')
}

export class CardnetGateway implements RefundableGateway {
  readonly provider: PaymentProvider = 'cardnet'
  readonly capabilities: GatewayCapabilities = {
    refund: true,
    void: true,
    paymentLinks: false,
    confirmation: 'pull', // sin webhook: hay que consultar
  }

  constructor(
    private readonly creds: CardnetCredentials,
    readonly mode: GatewayMode,
  ) {
    if (!creds.comercio) throw new Error('CardNet: falta comercio')
    if (!creds.terminal) throw new Error('CardNet: falta terminal')
    if (!creds.llave) throw new Error('CardNet: falta llave')
  }

  async createCharge(req: ChargeRequest): Promise<ChargeResult> {
    try {
      const fields: CardnetChargeFields = {
        Comercio: this.creds.comercio,
        Terminal: this.creds.terminal,
        TrxToken: req.reference,
        Monto: String(req.amountMinor),
        Moneda: (req.currency || this.creds.currency || 'DOP').toUpperCase(),
        ReturnUrl: req.successUrl,
      }
      const firma = signChargeRequest(fields, this.creds.llave)
      const params = new URLSearchParams({ ...fields, Firma: firma })
      const redirectUrl = `${CARDNET_HOST[this.mode]}/ztrans/pagar?${params.toString()}`
      return { status: 'redirect', redirectUrl, providerRef: fields.TrxToken }
    } catch (e: any) {
      return { status: 'failed', reason: e?.message || 'CardNet rechazó el armado del cobro' }
    }
  }

  /**
   * Modo 'pull': el retorno del navegador no prueba nada por sí solo (nadie lo firma al volver).
   * Hay que consultar activamente el estado de la transacción contra CardNet.
   */
  async confirm(ctx: ConfirmContext): Promise<PaymentOutcome | null> {
    const trxToken = ctx.providerRef || ctx.query?.TrxToken
    if (!trxToken) return null

    const res = await this.queryStatus(trxToken)
    if (!res) return null

    const status = this.mapStatus(res.ResponseCode)
    if (!status) return null

    return {
      eventId: `${trxToken}:${res.AuthorizationCode || res.Rrn || res.ResponseCode}`,
      providerRef: trxToken,
      status,
      amountMinor: Number(res.Monto || 0),
      currency: (res.Moneda || this.creds.currency || 'dop').toLowerCase(),
      reference: trxToken,
      raw: res,
    }
  }

  /**
   * Consulta activa de estado — reemplaza al webhook que CardNet no tiene.
   * ⚠️ A SPEC: endpoint y forma de la respuesta sin verificar contra el webservice real.
   */
  private async queryStatus(trxToken: string): Promise<CardnetStatusResponse | null> {
    const firma = signStatusQuery(this.creds.comercio, this.creds.terminal, trxToken, this.creds.llave)
    const url = `${CARDNET_HOST[this.mode]}/ztrans/api/status` +
      `?comercio=${encodeURIComponent(this.creds.comercio)}&terminal=${encodeURIComponent(this.creds.terminal)}` +
      `&trxToken=${encodeURIComponent(trxToken)}&firma=${firma}`
    try {
      const r = await fetch(url)
      if (!r.ok) return null
      return await r.json() as CardnetStatusResponse
    } catch {
      return null // red caída / host inalcanzable: sin confirmación, no se asume pagado
    }
  }

  /** A SPEC: '00' como único código de éxito es una suposición (convención ISO 8583 típica). */
  private mapStatus(responseCode: string): PaymentOutcome['status'] | null {
    if (!responseCode) return null
    return responseCode === '00' ? 'paid' : 'failed'
  }

  async refund(providerRef: string, amountMinor?: number): Promise<RefundResult> {
    const firma = signStatusQuery(this.creds.comercio, this.creds.terminal, providerRef, this.creds.llave)
    const r = await fetch(`${CARDNET_HOST[this.mode]}/ztrans/api/refund`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({
        Comercio: this.creds.comercio, Terminal: this.creds.terminal,
        TrxToken: providerRef, Monto: amountMinor, Firma: firma,
      }),
    })
    const body = await r.json().catch(() => ({})) as any
    if (!r.ok) throw new Error(body?.message || 'CardNet rechazó el reembolso')
    return { refundId: body?.RefundId || providerRef, status: body?.ResponseCode === '00' ? 'approved' : 'rejected' }
  }

  async voidCharge(providerRef: string): Promise<void> {
    const firma = signStatusQuery(this.creds.comercio, this.creds.terminal, providerRef, this.creds.llave)
    const r = await fetch(`${CARDNET_HOST[this.mode]}/ztrans/api/void`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ Comercio: this.creds.comercio, Terminal: this.creds.terminal, TrxToken: providerRef, Firma: firma }),
    })
    if (!r.ok) throw new Error('CardNet rechazó la anulación')
  }
}
