// services/payment-gateway/types.ts — Contrato común de las pasarelas de pago.
//
// El puerto NO se modela sobre Stripe. Azul (Payment Page y Webservices) y CardNet-Ztrans
// NO tienen webhook: confirman por redirect-con-hash o por consulta. Un contrato que asuma
// "creo el cobro y espero el webhook" deja afuera a los proveedores dominicanos.
//
// Los montos viajan SIEMPRE en unidades menores (centavos) como entero. Cada proveedor tiene
// su formato (Azul/CardNet enteros, PayPal string decimal, Stripe centavos) y cada adapter
// traduce. Un float suelto en un flujo de dinero es un bug esperando su turno.

export type PaymentProvider = 'stripe' | 'paypal' | 'azul' | 'cardnet'

/**
 * Proveedores con adapter escrito. ÚNICA fuente de verdad — antes vivía duplicado en
 * `modules/payment-gateways/service.ts` y en `registry.ts` (podían divergir en silencio).
 * El resto (paypal): el puerto lo admite, falta el adapter.
 */
export const IMPLEMENTED_PROVIDERS: PaymentProvider[] = ['stripe', 'azul', 'cardnet']

export type GatewayMode = 'test' | 'live'

/** Cómo se entera el sistema de que el dinero entró. */
export type ConfirmationMode =
  | 'push'    // el proveedor hace POST a nuestra URL (Stripe, PayPal) — firma sobre el body crudo
  | 'return'  // el navegador vuelve con el resultado (Azul Payment Page) — hash sobre campos fijos
  | 'pull'    // nadie avisa: hay que preguntar (CardNet Ztrans, Azul Webservices)

/**
 * Qué sabe hacer realmente este proveedor. La UI lee esto para no ofrecer un botón que va a
 * fallar: Azul Payment Page, por ejemplo, NO soporta reembolsos.
 */
export interface GatewayCapabilities {
  refund: boolean
  void: boolean
  paymentLinks: boolean
  confirmation: ConfirmationMode
}

export interface ChargeRequest {
  hotelId: string
  /** Entero en unidades menores (centavos). NUNCA un float. */
  amountMinor: number
  currency: string
  description: string
  /** Identificador nuestro (reserva, folio, payment request) para reconciliar después. */
  reference: string
  customerEmail?: string
  successUrl: string
  cancelUrl: string
  metadata?: Record<string, string>
}

/**
 * `createCharge` no devuelve "pagó / no pagó": devuelve un estado. Azul y CardNet tienen pasos
 * intermedios (redirect, 3DS) que Stripe abstrae, y el dominio tiene que poder representarlos.
 */
export type ChargeResult =
  | { status: 'redirect'; redirectUrl: string; providerRef: string }
  | { status: 'requires_action'; action: Record<string, unknown>; providerRef: string }
  | { status: 'succeeded'; providerRef: string }
  | { status: 'failed'; reason: string }

/** Lo que llega desde el proveedor, sin interpretar: cada adapter sabe leer lo suyo. */
export interface ConfirmContext {
  hotelId: string
  /** Bytes CRUDOS del body. Reconstruirlos con JSON.stringify NO reproduce la firma. */
  rawBody?: Buffer | string
  headers?: Record<string, string>
  query?: Record<string, string>
  /** Para el modo 'pull': la referencia que hay que ir a consultar. */
  providerRef?: string
}

export interface PaymentOutcome {
  /** Id del evento en el proveedor. Clave de idempotencia: el mismo cobro llega más de una vez. */
  eventId: string
  providerRef: string
  status: 'paid' | 'failed' | 'pending' | 'refunded'
  amountMinor: number
  currency: string
  reference: string
  raw?: unknown
}

export interface RefundResult {
  refundId: string
  status: string
}

export interface PaymentGateway {
  readonly provider: PaymentProvider
  readonly mode: GatewayMode
  readonly capabilities: GatewayCapabilities

  createCharge(req: ChargeRequest): Promise<ChargeResult>

  /**
   * Interpreta y AUTENTICA la confirmación del proveedor. Devuelve null si no es auténtica.
   * Para Azul es la única barrera que existe entre "el huésped pagó" y "alguien escribió una
   * URL a mano diciendo que pagó": no hay webhook de respaldo.
   */
  confirm(ctx: ConfirmContext): Promise<PaymentOutcome | null>
}

/**
 * Reembolso como capacidad OPCIONAL, no parte del contrato base: Azul Payment Page no lo
 * soporta. Si estuviera en la interfaz base, ese adapter tendría que lanzar "no implementado"
 * — un contrato que miente.
 */
export interface RefundableGateway extends PaymentGateway {
  refund(providerRef: string, amountMinor?: number): Promise<RefundResult>
  voidCharge(providerRef: string): Promise<void>
}

export function isRefundable(g: PaymentGateway): g is RefundableGateway {
  return g.capabilities.refund && typeof (g as RefundableGateway).refund === 'function'
}
