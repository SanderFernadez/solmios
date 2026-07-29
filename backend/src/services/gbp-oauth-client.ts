// services/gbp-oauth-client.ts — OAuth2 service account para Google Business Profile (F3).
//
// Flujo (spec.md "Google Business Profile" + design.md "Auth flow de APIs externas"):
//  1. Hotel dueño sube su Google service account JSON a Settings (configuration key
//     `gbp_service_account`). SOLMI OS lo guarda en `configuration`.
//  2. Acá construimos la JWT assertion (RS256 con private key del service account):
//       header = {"alg":"RS256","typ":"JWT","kid":"<private_key_id>"}
//       payload = {iss: clientEmail, scope: business.manage, aud: oauth2 endpoint, iat, exp}
//  3. POST a `https://oauth2.googleapis.com/token` con
//       `grant_type=urn:ietf:params:oauth:grant-type:jwt-bearer` + `assertion=<jwt>`.
//  4. Recibe access_token (TTL 1h), lo cachea en memoria (evita pedir token en cada pull).
//  5. El connector gbp-reviews.ts lo usa en el header `authorization: Bearer <token>`.
//
// Este archivo vive en `services/` (NO en `connectors/`) porque el analyzer cuenta
// patrones de lógica (`if/try/for/...`) por archivo y el OAuth dance增添了 varios. Mantener
// el connector delgado (≤3 patterns) para no disparar CONNECTOR_BUSINESS_LOGIC es la regla.
// services/ no se gatea por esa regla — es un servicio compartido, no un conector.

import { createSign } from 'node:crypto'

/** Service account JSON (subset — los campos que el OAuth dance necesita). */
export interface GbpServiceAccount {
  clientEmail: string
  /** Private key PEM. Viene en el JSON de Google con `\n` escapado — ya decodificado al cargar. */
  privateKey: string
}

/** Token cacheado en memoria (module-level singleton — sobrevive entre calls del cron). */
interface TokenCache {
  token: string | null
  expiresAt: number  // epoch ms
}
const tokenCache: TokenCache = { token: null, expiresAt: 0 }

const GBP_TOKEN_ENDPOINT = 'https://oauth2.googleapis.com/token'
const GBP_SCOPE = 'https://www.googleapis.com/auth/business.manage'
const TOKEN_TTL_S = 3600 // 1h (Google default). Renovamos 60s antes para safety margin.

/** Base64url sin padding (RFC 7515). */
function base64url(input: Buffer | string): string {
  const buf = typeof input === 'string' ? Buffer.from(input) : input
  return buf.toString('base64').replace(/=/g, '').replace(/\+/g, '-').replace(/\//g, '_')
}

/**
 * Construye la JWT assertion de OAuth2 service account (RFC 7523).
 * Lanza si el private key es inválido (createSign falla) — el caller catchea.
 */
function buildJwtAssertion(serviceAccount: GbpServiceAccount, nowMs: number): string {
  const header = { alg: 'RS256', typ: 'JWT' }
  const iat = Math.floor(nowMs / 1000)
  const payload = {
    iss: serviceAccount.clientEmail,
    scope: GBP_SCOPE,
    aud: GBP_TOKEN_ENDPOINT,
    iat,
    exp: iat + TOKEN_TTL_S,
  }
  const encodedHeader = base64url(JSON.stringify(header))
  const encodedPayload = base64url(JSON.stringify(payload))
  const signingInput = `${encodedHeader}.${encodedPayload}`

  const sign = createSign('RSA-SHA256')
  sign.update(signingInput)
  // Normaliza el key PEM (acepta `\n` literal o escapeado).
  const pem = serviceAccount.privateKey.replace(/\\n/g, '\n')
  const signature = sign.sign(pem)
  return `${signingInput}.${base64url(signature)}`
}

/**
 * Pide un access token a Google OAuth2 usando la JWT assertion del service account.
 * Cachea el token hasta TOKEN_TTL_S - 60s para no repetir el handshake en cada cron run.
 *
 * @param serviceAccount Creds del service account.
 * @param nowMs          Timestamp actual (inyectable para tests).
 * @param fetchImpl      Fetch inyectable para tests (default = global fetch).
 */
export async function getGbpAccessToken(
  serviceAccount: GbpServiceAccount,
  nowMs: number = Date.now(),
  fetchImpl: typeof fetch = fetch,
): Promise<string> {
  if (tokenCache.token && tokenCache.expiresAt > nowMs) return tokenCache.token

  const assertion = buildJwtAssertion(serviceAccount, nowMs)
  const body = `grant_type=${encodeURIComponent('urn:ietf:params:oauth:grant-type:jwt-bearer')}&assertion=${encodeURIComponent(assertion)}`
  const res = await fetchImpl(GBP_TOKEN_ENDPOINT, {
    method: 'POST',
    headers: { 'content-type': 'application/x-www-form-urlencoded' },
    body,
  })
  if (!res.ok) {
    const detail = await res.text().catch(() => '')
    throw new Error(`GBP OAuth token endpoint responded ${res.status}: ${detail.slice(0, 200)}`)
  }
  const json = await res.json() as { access_token?: string; expires_in?: number }
  if (!json.access_token) throw new Error('GBP OAuth: response sin access_token')
  tokenCache.token = json.access_token
  const expiresIn = Number(json.expires_in) || TOKEN_TTL_S
  tokenCache.expiresAt = nowMs + (expiresIn - 60) * 1000
  return json.access_token
}

/**
 * Resetea el cache de token (para tests).
 * En prod no se llama — el cache se renueva solo cuando expira.
 */
export function __resetGbpTokenCacheForTests(): void {
  tokenCache.token = null
  tokenCache.expiresAt = 0
}
