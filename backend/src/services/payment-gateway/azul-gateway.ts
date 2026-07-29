// services/payment-gateway/azul-gateway.ts — Adapter de Azul Payment Page (Banco Popular Dominicano).
//
// ⚠️ A SPEC — SIN VERIFICAR CONTRA SANDBOX REAL. No hay credenciales de comercio de Azul todavía.
// Los NOMBRES DE CAMPO, el orden de concatenación del hash y las URLs de Payment Page de este
// archivo son una implementación PLAUSIBLE a partir del patrón público conocido de "hosted payment
// page" con firma HASH SHA-512 (MerchantId + AuthKey secreta, ida y vuelta). CONFIRMAR letra por
// letra contra el manual de integración oficial de Azul Payment Page (Banco Popular Dominicano)
// apenas lleguen credenciales de comercio — no se puede probar end-to-end sin ellas.
//
// Azul distingue dos productos:
//   - Azul Payment Page: redirect hospedado, SIN webhook, confirma leyendo el retorno + hash
//     (esto es lo que implementa este adapter — `capabilities.confirmation === 'return'`).
//   - Azul Webservices: API directa server-to-server autenticada con mTLS (certificado cliente),
//     usada normalmente para cobro/consulta/reverso sin redirigir al huésped.
// El certificado (certPem/certKeyPem) se guarda en las credenciales igual porque algunos comercios
// de Azul lo piden incluso para operaciones de soporte de Payment Page (verificación/consulta) —
// dejar el campo listo, aunque createCharge()/confirm() de Payment Page en sí no lo necesiten.

import { createHash } from 'node:crypto'
import type {
  ChargeRequest, ChargeResult, ConfirmContext, GatewayCapabilities, GatewayMode,
  PaymentGateway, PaymentOutcome, PaymentProvider,
} from './types'
// Refactor cross-cutting: currency desde el enum global (shared/currency.ts — source of truth).
import { CurrencyCode } from '../../shared/currency'

export interface AzulCredentials {
  /** MerchantId asignado por Azul al afiliar el comercio. */
  merchantId: string
  /** AuthKey secreta: la llave con la que se firma (y verifica) el AuthHash. */
  authKey: string
  /** Certificado cliente (mTLS), PEM. Lo exige Azul Webservices, no Payment Page en sí. */
  certPem?: string
  /** Llave privada del certificado cliente, PEM. */
  certKeyPem?: string
  currency?: string
}

/**
 * Traduce el JSON genérico de `payment_gateways.credentials` (mismo shape que Stripe/CardNet:
 * secretKey/merchantId/terminalId/certPem/certKeyPem — ver usecases/build-credentials.ts) al
 * shape propio de Azul. Centralizado acá para que `registry.ts` y el usecase de `testConnection`
 * no dupliquen el mapeo ni lo hagan divergir.
 */
export function toAzulCredentials(stored: Record<string, unknown>): AzulCredentials {
  return {
    merchantId: String(stored.merchantId || ''),
    authKey: String(stored.secretKey || ''), // "llave secreta" genérica = AuthKey de Azul
    certPem: stored.certPem ? String(stored.certPem) : undefined,
    certKeyPem: stored.certKeyPem ? String(stored.certKeyPem) : undefined,
    currency: stored.currency ? String(stored.currency) : undefined,
  }
}

/** A SPEC — confirmar los hosts reales de Payment Page contra el manual de Azul. */
const AZUL_PAYMENT_PAGE_URL: Record<GatewayMode, string> = {
  test: 'https://pruebas.azul.com.do/paymentpage/Default.aspx',
  live: 'https://pagos.azul.com.do/paymentpage/Default.aspx',
}

/**
 * Campos que viajan HACIA Azul Payment Page. Nombres y orden A SPEC (no verificados).
 */
export interface AzulPaymentPageFields {
  MerchantId: string
  MerchantName: string
  MerchantType: string
  CurrencyCode: string
  OrderNumber: string
  /** Entero en unidades menores (centavos), como string — Azul no usa floats. */
  Amount: string
  /** Impuesto ya incluido en el total facturado aparte por SolmiOS: se manda en 0. */
  ITBIS: string
  ApprovedUrl: string
  DeclinedUrl: string
  CancelUrl: string
}

/**
 * Hash de ida (AuthHash): SHA-512 hex de la concatenación de los campos + AuthKey.
 * Función PURA y testeable a propósito, separada del resto del adapter.
 *
 * ⚠️ A SPEC: el orden real de concatenación de Azul Payment Page no está verificado contra
 * documentación oficial. Ajustar cuando llegue el manual real del comercio.
 */
export function buildAuthHash(fields: AzulPaymentPageFields, authKey: string): string {
  const concat = [
    fields.MerchantId, fields.MerchantName, fields.MerchantType, fields.CurrencyCode,
    fields.OrderNumber, fields.Amount, fields.ITBIS,
    fields.ApprovedUrl, fields.DeclinedUrl, fields.CancelUrl,
    authKey,
  ].join('')
  return createHash('sha512').update(concat, 'utf8').digest('hex').toUpperCase()
}

/** Campos que Azul manda de VUELTA en el redirect de retorno (query string). A SPEC. */
export interface AzulReturnFields {
  OrderNumber: string
  Amount: string
  AuthorizationCode?: string
  /** 'Approved' | 'Declined' | 'Cancel' (a spec — confirmar los valores reales). */
  ResponseCode: string
  IsoCode?: string
  RRN?: string
  AzulOrderId?: string
  /** Hash que Azul calcula sobre el retorno; debemos poder reproducirlo con la misma fórmula. */
  AuthHash: string
}

/**
 * Verifica el hash de retorno recalculándolo con la MISMA fórmula (campos fijos + AuthKey) y
 * comparando contra el que mandó Azul. Es la única barrera contra un retorno falsificado: Payment
 * Page no tiene webhook de respaldo, así que si esto no autentica, no hay otra fuente de verdad.
 *
 * ⚠️ A SPEC: mismo disclaimer que buildAuthHash — campos y orden del hash de vuelta sin verificar.
 */
export function verifyReturnHash(fields: AzulReturnFields, authKey: string): boolean {
  const concat = [
    fields.OrderNumber, fields.Amount, fields.ResponseCode,
    fields.AuthorizationCode || '', fields.IsoCode || '', fields.RRN || '',
    authKey,
  ].join('')
  const expected = createHash('sha512').update(concat, 'utf8').digest('hex').toUpperCase()
  return expected === (fields.AuthHash || '').toUpperCase()
}

export class AzulGateway implements PaymentGateway {
  readonly provider: PaymentProvider = 'azul'
  readonly capabilities: GatewayCapabilities = {
    // Payment Page NO soporta reembolso/anulación (eso requiere afiliación a Azul Webservices).
    refund: false,
    void: false,
    paymentLinks: false,
    confirmation: 'return', // sin webhook: confirma leyendo el retorno + AuthHash
  }

  constructor(
    private readonly creds: AzulCredentials,
    readonly mode: GatewayMode,
  ) {
    if (!creds.merchantId) throw new Error('Azul: falta merchantId')
    if (!creds.authKey) throw new Error('Azul: falta authKey')
  }

  /**
   * Arma el redirect a Azul Payment Page. En una integración real Azul exige que estos campos
   * viajen por un formulario HTML auto-submit vía POST (no un GET con querystring) — el AuthHash
   * y el resto de campos no deberían ir expuestos en una URL que queda en logs/historial. El
   * contrato `ChargeResult.redirect` de este puerto solo transporta una `redirectUrl: string`, así
   * que acá se codifican como querystring; el caller (usecase de checkout) es responsable de
   * renderizar el POST real si el manual de Azul lo exige. Limitación documentada a propósito,
   * no un olvido.
   */
  async createCharge(req: ChargeRequest): Promise<ChargeResult> {
    try {
      const fields: AzulPaymentPageFields = {
        MerchantId: this.creds.merchantId,
        MerchantName: 'SolmiOS',
        MerchantType: 'ECommerce',
        CurrencyCode: (req.currency || this.creds.currency || CurrencyCode.USD).toUpperCase(),
        OrderNumber: req.reference,
        Amount: String(req.amountMinor),
        ITBIS: '0',
        ApprovedUrl: req.successUrl,
        DeclinedUrl: req.cancelUrl,
        CancelUrl: req.cancelUrl,
      }
      const authHash = buildAuthHash(fields, this.creds.authKey)
      const params = new URLSearchParams({ ...fields, AuthHash: authHash })
      const redirectUrl = `${AZUL_PAYMENT_PAGE_URL[this.mode]}?${params.toString()}`
      return { status: 'redirect', redirectUrl, providerRef: fields.OrderNumber }
    } catch (e: any) {
      return { status: 'failed', reason: e?.message || 'Azul rechazó el armado del cobro' }
    }
  }

  /**
   * Confirma leyendo los campos que Azul manda al volver (query del redirect). Sin esta
   * verificación, cualquiera podría escribir a mano la URL de retorno y simular un pago aprobado
   * — acá NO hay webhook de respaldo que lo contradiga.
   */
  async confirm(ctx: ConfirmContext): Promise<PaymentOutcome | null> {
    const q = ctx.query || {}
    const fields: AzulReturnFields = {
      OrderNumber: q.OrderNumber || '',
      Amount: q.Amount || '',
      AuthorizationCode: q.AuthorizationCode,
      ResponseCode: q.ResponseCode || '',
      IsoCode: q.IsoCode,
      RRN: q.RRN,
      AzulOrderId: q.AzulOrderId,
      AuthHash: q.AuthHash || '',
    }
    if (!fields.OrderNumber || !fields.AuthHash) return null
    if (!verifyReturnHash(fields, this.creds.authKey)) return null // hash inválido → impostor

    const status = this.mapStatus(fields.ResponseCode)
    if (!status) return null

    return {
      eventId: fields.AzulOrderId || `${fields.OrderNumber}:${fields.RRN || fields.AuthorizationCode || ''}`,
      providerRef: fields.AzulOrderId || fields.OrderNumber,
      status,
      amountMinor: Number(fields.Amount || 0),
      currency: (this.creds.currency || 'usd').toLowerCase(),
      reference: fields.OrderNumber,
      raw: fields,
    }
  }

  /** A SPEC: valores de ResponseCode sin confirmar contra el manual real. */
  private mapStatus(responseCode: string): PaymentOutcome['status'] | null {
    const code = (responseCode || '').toLowerCase()
    if (code === 'approved' || code === '00' || code === '1') return 'paid'
    if (code === 'declined' || code === 'cancel' || code === '0' || code === '2') return 'failed'
    return null
  }
}
