// payment-gateways/sockets.ts — Hooks OPCIONALES hacia otros módulos.
// Los sockets son opcionales. El módulo funciona sin ellos.

import type { PaymentGatewayDTO } from './types'

export interface PaymentGatewaysSockets {
  onGatewayConfigured?: (data: PaymentGatewayDTO) => Promise<void>
  onGatewayRemoved?: (id: string) => Promise<void>
}
