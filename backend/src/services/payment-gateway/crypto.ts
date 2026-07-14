// services/payment-gateway/crypto.ts — Cifrado at-rest de las credenciales de pasarela.
//
// El precedente del proyecto (ttlock_config) guarda los secretos en texto plano. Acá se guardan
// llaves que mueven dinero: la secretKey de Stripe permite cobrar y reembolsar contra la cuenta
// del hotel. Un dump de la tabla no puede entregar eso en claro.
//
// AES-256-GCM: cifra y autentica (detecta manipulación). Formato: v1:<iv>:<tag>:<ciphertext>,
// todo en base64. El prefijo de versión permite rotar el algoritmo sin romper lo ya guardado.

import { createCipheriv, createDecipheriv, randomBytes, createHash } from 'node:crypto'

const VERSION = 'v1'
const ALGO = 'aes-256-gcm'
const IV_BYTES = 12 // recomendado para GCM

/**
 * Deriva la clave de 32 bytes desde PAYMENTS_ENCRYPTION_KEY.
 * Falla fuerte si no está: preferimos que el sistema no arranque a que guarde llaves en claro
 * creyendo que las cifró.
 */
function masterKey(): Buffer {
  const raw = process.env.PAYMENTS_ENCRYPTION_KEY
  if (!raw || raw.length < 32) {
    throw new Error(
      'PAYMENTS_ENCRYPTION_KEY faltante o muy corta (mín. 32 chars). ' +
      'Sin ella no se pueden cifrar las credenciales de pasarela. ' +
      'Generar con: openssl rand -base64 32',
    )
  }
  // Normaliza cualquier largo a 32 bytes exactos.
  return createHash('sha256').update(raw, 'utf8').digest()
}

/** ¿Está el sistema en condiciones de guardar credenciales? Para avisar en el arranque. */
export function isEncryptionConfigured(): boolean {
  try {
    masterKey()
    return true
  } catch {
    return false
  }
}

export function encryptCredentials(plain: Record<string, unknown>): string {
  const iv = randomBytes(IV_BYTES)
  const cipher = createCipheriv(ALGO, masterKey(), iv)
  const json = JSON.stringify(plain)
  const ct = Buffer.concat([cipher.update(json, 'utf8'), cipher.final()])
  const tag = cipher.getAuthTag()
  return [VERSION, iv.toString('base64'), tag.toString('base64'), ct.toString('base64')].join(':')
}

export function decryptCredentials(payload: string): Record<string, unknown> {
  if (!payload) return {}
  const parts = payload.split(':')
  if (parts.length !== 4 || parts[0] !== VERSION) {
    throw new Error('Credenciales de pasarela con formato desconocido o corrupto')
  }
  const [, ivB64, tagB64, ctB64] = parts
  const decipher = createDecipheriv(ALGO, masterKey(), Buffer.from(ivB64, 'base64'))
  decipher.setAuthTag(Buffer.from(tagB64, 'base64'))
  const out = Buffer.concat([decipher.update(Buffer.from(ctB64, 'base64')), decipher.final()])
  return JSON.parse(out.toString('utf8'))
}

/**
 * Enmascara un secreto para mostrarlo sin exponerlo (ej: "sk_live_...4242").
 * La API nunca devuelve la credencial completa: devuelve esto o un flag.
 */
export function maskSecret(secret?: string): string {
  if (!secret) return ''
  if (secret.length <= 8) return '••••'
  return `${secret.slice(0, 7)}…${secret.slice(-4)}`
}
