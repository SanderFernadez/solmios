// payment-gateways/model.ts — Schema de base de datos

import type { ModelDefinition, ORM } from 'arckode-framework'

/**
 * Credenciales de pasarela POR HOTEL. Cada dueño cobra a su propia cuenta.
 * `credentials` va cifrado (AES-256-GCM) — nunca en texto plano: es la llave que mueve el dinero.
 */
export const PaymentGatewaysModel: ModelDefinition = {
  table: 'payment_gateways',
  fields: {
    id: { type: 'string', required: true },
    hotelId: { type: 'string', required: true, indexed: true },
    provider: { type: 'string', required: true }, // stripe | paypal | azul | cardnet
    // Columna explícita, NO inferida del prefijo de la llave: Stripe se distingue por
    // sk_test_/sk_live_, pero Azul separa test y producción por host y credenciales distintas.
    mode: { type: 'string', required: true, default: 'test' }, // test | live
    credentials: { type: 'string', required: true }, // cifrado AES-256-GCM
    enabled: { type: 'boolean', default: false },
    isDefault: { type: 'boolean', default: false },
  },
  timestamps: true,
}

/**
 * Anti-replay. Stripe reintenta webhooks; CardNet reintenta hasta recibir 200; el huésped puede
 * recargar la página de retorno de Azul. El mismo cobro VA a llegar más de una vez. Sin esta
 * tabla, un reintento asienta el dinero dos veces.
 */
export const PaymentEventsModel: ModelDefinition = {
  table: 'payment_events',
  fields: {
    id: { type: 'string', required: true },
    hotelId: { type: 'string', required: true, indexed: true },
    provider: { type: 'string', required: true },
    eventId: { type: 'string', required: true, indexed: true }, // id del evento en el proveedor
    providerRef: { type: 'string' },
    reference: { type: 'string' },
    status: { type: 'string' },
    amountMinor: { type: 'number', default: 0 },
    currency: { type: 'string' },
    processedAt: { type: 'string' },
  },
  timestamps: true,
}

export function registerPaymentGatewaysModels(orm: ORM): void {
  orm.define('PaymentGateways', PaymentGatewaysModel)
  orm.define('PaymentEvents', PaymentEventsModel)
}
