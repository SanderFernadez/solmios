// apikeys/usecases/secret.ts — Generación y proyección segura de secretos de API key (G5).
//
// Antes el `secretHash` era un passthrough del cliente: se guardaba tal cual (en claro) y se
// devolvía en GET/list. Un secreto que el cliente elige y que la API muestra no es un secreto.
//
// Ahora el secreto lo genera el SERVIDOR, se guarda solo su hash, y el valor en claro se devuelve
// UNA sola vez al crear (para copiarlo). SHA-256 es apropiado: una API key es de alta entropía
// (no una password de diccionario), así que no necesita el work-factor de bcrypt; sí una
// comparación en tiempo constante cuando se implemente la autenticación por key.

import { createHash, randomBytes } from 'crypto'

export interface GeneratedKey {
  /** Secreto en claro. Se devuelve UNA vez al crear; NUNCA se persiste ni se relee. */
  plainKey: string
  /** Lo que se guarda: SHA-256 del secreto. */
  secretHash: string
  /** Prefijo + cola para mostrar en listados sin revelar el secreto. */
  masked: string
}

export function generateApiKey(prefix = 'sk'): GeneratedKey {
  const raw = randomBytes(24).toString('base64url') // ~32 chars, alta entropía
  const plainKey = `${prefix}_${raw}`
  const secretHash = createHash('sha256').update(plainKey).digest('hex')
  const masked = `${prefix}_${'•'.repeat(6)}${raw.slice(-4)}`
  return { plainKey, secretHash, masked }
}

/** Quita el hash del secreto antes de devolver una key en lecturas (GET/list). */
export function stripSecret<T extends Record<string, any>>(item: T): Omit<T, 'secretHash'> {
  const { secretHash: _omit, ...rest } = item
  return rest
}
