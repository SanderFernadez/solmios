// wallet-pass/usecases/google-pass.ts — Generación del save URL de Google Wallet (F3 3.7).
//
// Spec: wallet-pass/spec.md "Google Wallet". Requiere:
//   - configuration('google_service_account'): JSON de service account de Google Cloud.
//   - configuration('google_pass_issuer_id'): issuer ID de Google Wallet (único por proyecto).
//   - configuration('google_pass_class_id'): pass class ID (formato issuerId.identifier).
//
// Flujo (spec.md:188-192):
//   1. Construir un JWT con claim de tipo "saveMode" + objeto + clase del pass.
//   2. Firmar con la private key de la service account (RS256).
//   3. URL "Add to Google Wallet" = `https://pay.google.com/gp/v/save/<jwt>`.
//
// Best-effort: si falta SA o el JWT falla, devuelve `url=null` + `reason`. El caller
// sigue con Apple pass y persiste lo que haya. Sin dependency npm externa (crypto de Bun).
//
// Storage: NO se sube nada al bucket. El JWT va embebido en la URL save — Google lo
// resuelve del otro lado. Mucho más simple que el .pkpass de Apple.
//
// Anti-patrón ORM: este usecase NO toca el ORM directo. Lee `configuration` vía repo
// inyectado y firma con WebCrypto (built-in Bun).
import type { RepositoryAdapter, Logger } from 'arckode-framework'
import type { GooglePassResult } from '../types'

/** Deps inyectadas por el service (todo por constructor, no ORM directo). */
export interface GooglePassDeps {
  /** Repo ORM `Configuration` (multi-tenant). Lectura para creds del hotel. */
  configRepo: RepositoryAdapter<Record<string, unknown>>
  logger: Logger
}

/** Configuración Google del hotel resuelta desde `configuration`. */
export interface GooglePassConfig {
  /** JSON de service account completo (client_email, private_key, ...). */
  serviceAccountJson?: string | null
  /** Issuer ID de Google Wallet (ej. "3388000000000000000"). */
  issuerId?: string | null
  /** Pass class ID completo (ej. "3388000000000000000.hotel-slug-room"). */
  classId?: string | null
}

const GOOGLE_SAVE_URL = 'https://pay.google.com/gp/v/save/'

/** Lee la configuration(key='google_*') del hotel y la normaliza. */
async function resolveGoogleConfig(deps: GooglePassDeps, hotelId: string): Promise<GooglePassConfig> {
  const rows = await deps.configRepo.findMany({ hotelId }).catch(() => [])
  const cfg: Record<string, unknown> = {}
  for (const row of rows) {
    const key = String(row.key ?? '')
    const raw = row.value
    if (typeof raw === 'string' && (raw.startsWith('{') || raw.startsWith('['))) {
      try { cfg[key] = JSON.parse(raw); continue } catch { /* noop */ }
    }
    cfg[key] = raw
  }
  const sa = cfg['google_service_account']
  // serviceAccount puede venir como string JSON o como objeto ya parseado.
  const saJson = typeof sa === 'string' ? sa : (sa ? JSON.stringify(sa) : null)
  return {
    serviceAccountJson: saJson,
    issuerId: (cfg['google_pass_issuer_id'] ?? null) as string | null,
    classId: (cfg['google_pass_class_id'] ?? null) as string | null,
  }
}

/**
 * Base64url sin padding (lo que pide JWT).
 * Implementación nativa sin depender de una librería externa.
 */
function b64url(input: Uint8Array | string): string {
  const buf = typeof input === 'string' ? Buffer.from(input) : Buffer.from(input)
  return buf.toString('base64').replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '')
}

/**
 * Firma RS256 con la private key de la service account usando WebCrypto (built-in Bun).
 * Devuelve el JWT completo `header.payload.signature`.
 */
async function signRs256(privateKeyPem: string, payload: object): Promise<string> {
  const header = { alg: 'RS256', typ: 'JWT' }
  const enc = new TextEncoder()
  // Importar la PEM como CryptoKey (Bun soporta 'pkcs8' directamente).
  const pemBody = privateKeyPem
    .replace(/-----BEGIN PRIVATE KEY-----/, '')
    .replace(/-----END PRIVATE KEY-----/, '')
    .replace(/\s+/g, '')
  const der = Buffer.from(pemBody, 'base64')
  const key = await crypto.subtle.importKey(
    'pkcs8', der, { name: 'RSASSA-PKCS1-v1_5', hash: 'SHA-256' }, false, ['sign'],
  )
  const data = `${b64url(JSON.stringify(header))}.${b64url(JSON.stringify(payload))}`
  const sig = await crypto.subtle.sign('RSASSA-PKCS1-v1_5', key, enc.encode(data))
  return `${data}.${b64url(new Uint8Array(sig))}`
}

/**
 * Genera el save URL de Google Wallet para la reserva. Best-effort.
 *
 * NO lanza. El caller (generate-pass.ts) decide qué hacer con `reason`.
 */
export async function generateGooglePass(
  deps: GooglePassDeps,
  input: {
    hotelId: string
    reservationId: string
    lockCode: string
    hotelName: string
    checkIn: string
    checkOut: string
    roomNumber?: string
  },
): Promise<GooglePassResult> {
  const cfg = await resolveGoogleConfig(deps, input.hotelId)

  // 1) Sin service account → no hay pass Google. Caso común (Google Cloud project a crear).
  if (!cfg.serviceAccountJson) {
    return { url: null, reason: 'no_service_account' }
  }
  if (!cfg.issuerId || !cfg.classId) {
    deps.logger.warn('google-pass: SA presente pero falta issuerId/classId', { hotelId: input.hotelId })
    return { url: null, reason: 'no_service_account' }
  }

  let sa: { client_email?: string; private_key?: string }
  try {
    sa = JSON.parse(cfg.serviceAccountJson)
  } catch (e: unknown) {
    deps.logger.warn('google-pass: service account JSON inválido', { hotelId: input.hotelId, error: (e as Error).message })
    return { url: null, reason: 'jwt_failed' }
  }
  if (!sa.private_key) {
    deps.logger.warn('google-pass: SA sin private_key', { hotelId: input.hotelId })
    return { url: null, reason: 'jwt_failed' }
  }

  try {
    // 2) Object ID único: <classId>.<reservationId> (estable, deducible, único por reserva).
    const objectId = `${cfg.classId}.${input.reservationId}`
    // 3) Payload del JWT — formato "vertical" de Google Wallet (saveUrl + objetos).
    //    References: https://developers.google.com/wallet/generic/android/save-passes#save-link-jwt
    const payload = {
      iss: sa.client_email,
      aud: 'google',
      typ: 'savetowallet',
      orig: 'SolmiOS',
      payload: {
        genericObjects: [
          {
            id: objectId,
            classId: cfg.classId,
            genericType: 'GENERIC_TYPE_1',
            logo: {
              sourceUri: { uri: '' },
              contentDescription: { defaultValue: { language: 'es', value: input.hotelName } },
            },
            cardTitle: { defaultValue: { language: 'es', value: input.hotelName } },
            subtitle: { defaultValue: { language: 'es', value: `Habitación ${input.roomNumber ?? '—'}` } },
            header: { defaultValue: { language: 'es', value: 'Código de acceso' } },
            textModulesData: [
              { header: 'Código', body: input.lockCode, id: 'code' },
              { header: 'Check-in', body: input.checkIn, id: 'in' },
              { header: 'Check-out', body: input.checkOut, id: 'out' },
            ],
            barcode: { type: 'QR_CODE', value: input.lockCode, alternateText: input.lockCode },
          },
        ],
      },
    }
    const jwt = await signRs256(sa.private_key, payload)
    return { url: `${GOOGLE_SAVE_URL}${jwt}`, reason: 'ok' }
  } catch (e: unknown) {
    deps.logger.warn('google-pass: JWT falló', {
      hotelId: input.hotelId, reservationId: input.reservationId, error: (e as Error).message,
    })
    return { url: null, reason: 'jwt_failed' }
  }
}
