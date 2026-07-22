// webhooks/usecases/secret.ts — Generación del secreto de firma HMAC (mismo criterio que
// apikeys/usecases/secret.ts G5): el secreto lo genera el SERVIDOR, nunca lo elige el cliente.
//
// A diferencia de apikeys, este secreto SÍ se guarda en claro (no un hash): el dispatcher lo
// necesita para calcular la firma HMAC-SHA256 en cada entrega — es el mismo modelo que usan
// Stripe/GitHub para sus webhook secrets (`whsec_...`).

import { randomBytes } from 'crypto'

export function generateWebhookSecret(): string {
  return `whsec_${randomBytes(24).toString('base64url')}`
}

/** Prefijo + cola para mostrar en listados sin revelar el secreto completo. */
export function maskWebhookSecret(secret: string | undefined): string {
  if (!secret) return '••••••••'
  const tail = secret.slice(-4)
  return `whsec_${'•'.repeat(6)}${tail}`
}
