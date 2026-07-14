// infrastructure/stripe-config.ts — Resolver de credenciales de Stripe para el StripeService
// compartido (lo usa `payment-requests`).
//
// FUENTE DE VERDAD: la tabla `payment_gateways` (por hotel, cifrada). Antes leía
// `configuration.stripe_config`, en texto plano y sin modo test/live explícito.
//
// El fallback a `configuration` queda solo para hoteles que hayan cargado sus llaves con el
// esquema viejo. Avisa por warning y se elimina cuando ninguno dependa de él (en producción no
// hay ninguna fila `stripe_config`: verificado 2026-07-14).

import { StripeService } from '../services/stripe-service'
import { decryptCredentials } from '../services/payment-gateway/crypto'

export function configureStripe(orm: any, logger?: any): void {
  StripeService.setConfigResolver(async (hotelId) => {
    if (!hotelId) return null

    // 1. Pasarela del hotel (esquema nuevo, cifrado).
    const gateways = await orm.findMany('PaymentGateways', { hotelId, provider: 'stripe' }) as any[]
    const active = gateways.find(g => g.enabled) ?? gateways[0]
    if (active?.credentials) {
      try {
        const creds = decryptCredentials(active.credentials) as any
        if (creds?.secretKey) return creds
      } catch (e: any) {
        // Credenciales ilegibles: NO caer a otra cuenta — sería cobrar en la cuenta equivocada.
        logger?.error?.(`Stripe del hotel ${hotelId}: credenciales ilegibles (${e?.message})`)
        return null
      }
    }

    // 2. Legacy: configuration.stripe_config, en texto plano.
    const rows = await orm.findMany('Configuration', { hotelId, key: 'stripe_config' }) as any[]
    const v = rows[0]?.value
    let cfg: any = v
    if (typeof v === 'string') { try { cfg = JSON.parse(v) } catch { cfg = null } }
    if (cfg?.secretKey) {
      logger?.warn?.(
        `Hotel ${hotelId} usa el esquema viejo de llaves Stripe (configuration.stripe_config, sin cifrar). ` +
        'Migrar a payment_gateways desde /panel/pagos.',
      )
      return cfg
    }
    return null
  })
}
