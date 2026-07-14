// payment-gateways/types.ts — DTOs de la API (≠ model.ts, que es el schema de BD)

import type { GatewayMode, PaymentProvider, ConfirmationMode } from '../../services/payment-gateway/types'

export type { GatewayMode, PaymentProvider }

/** Fila tal cual vive en la BD (credentials CIFRADO). Uso interno: nunca sale por la API. */
export interface PaymentGatewayRow {
  id: string
  hotelId: string
  provider: PaymentProvider
  mode: GatewayMode
  credentials: string
  enabled: boolean
  isDefault: boolean
  createdAt?: string
  updatedAt?: string
}

/**
 * Lo que SÍ sale por la API. Sin credenciales: solo si existen y una máscara.
 * Mismo criterio que TTLock: la UI necesita saber que el secreto está guardado, no cuál es.
 */
export interface PaymentGatewayDTO {
  id: string
  provider: PaymentProvider
  mode: GatewayMode
  enabled: boolean
  isDefault: boolean
  /** Prefijo+sufijo, ej "sk_live…4242". Nunca la llave completa. */
  secretMask: string
  hasSecret: boolean
  hasWebhookSecret: boolean
  currency?: string
  capabilities: {
    refund: boolean
    void: boolean
    paymentLinks: boolean
    confirmation: ConfirmationMode
  }
  /** false = el puerto lo admite pero todavía no hay adapter (Azul, CardNet, PayPal). */
  implemented: boolean
  updatedAt?: string
}

export interface UpsertPaymentGatewayDTO {
  provider: PaymentProvider
  mode: GatewayMode
  /** Vacío = conservar el guardado (no hay que re-tipear el secreto para cambiar la moneda). */
  secretKey?: string
  publishableKey?: string
  webhookSecret?: string
  currency?: string
  enabled?: boolean
  isDefault?: boolean
}

export interface TestConnectionResult {
  ok: boolean
  message: string
  accountName?: string
}
