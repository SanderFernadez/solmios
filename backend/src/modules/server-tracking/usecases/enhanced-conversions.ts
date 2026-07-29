// server-tracking/usecases/enhanced-conversions.ts — Hashing SHA256 de PII (F3 3.11).
//
// Spec: server-tracking/spec.md "Enhanced Conversions (hashed PII)".
// Meta CAPI REQUIERE que email y phone se manden hasheados SHA256 en hexadecimal
// lowercase. NUNCA mandar PII en claro server-side (regla LGDP/GDPR + Meta TOS).
//
// Normalización ANTES de hashear (spec.md scenario "Hash correcto"):
//   - email: trim + lowercase. Ej: 'Juan.Perez@Example.com' → 'juan.perez@example.com'.
//   - phone: trim + sacar espacios, '+', guiones, paréntesis. Meta espera E.164 sin '+'.
//            Ej: '+1 809 555 0000' → '18095550000'.
//
// Si el input está vacío o es inválido (ej. phone sin dígitos), devolvemos null → el caller
// (meta-capi.ts) OMITE el campo del payload (no lo manda hasheado vacío). Spec.md scenario
// "Usuario rechaza consentimiento" → user_data va vacío.
//
// El algoritmo SHA256 vive en Web Crypto (Bun lo expone como global `crypto.subdigest`).
// Lo envolvemos en `enhancedConversions` para poder mockear en tests sin tocar el runtime.

/**
 * Hashea un valor con SHA256 y devuelve hex lowercase. PÚBLICO para tests.
 * Si el input es vacío/string solo-whitespace → devuelve null.
 */
export async function hashSha256(value: string | null | undefined): Promise<string | null> {
  const trimmed = (value ?? '').trim()
  if (!trimmed) return null
  // Bun expone `crypto.subtle` (Web Crypto). SHA-256 devuelve un ArrayBuffer;
  // lo convertimos a hex lowercase en grupos de 2 chars (padre de byte).
  const buf = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(trimmed))
  return Array.from(new Uint8Array(buf))
    .map((b) => b.toString(16).padStart(2, '0'))
    .join('')
}

/**
 * Normaliza un email ANTES de hashearlo (spec.md scenario "Hash correcto").
 * - trim + lowercase.
 * - NO aplica otros mungings (Meta no pide + alias).
 */
export function normalizeEmail(email: string | null | undefined): string {
  return (email ?? '').trim().toLowerCase()
}

/**
 * Normaliza un phone ANTES de hashearlo (spec.md scenario "Hash correcto").
 * - Saca todo lo que no sea dígito (espacios, '+', '()', '-', ' ').
 * - Si queda vacío → '' (caller decide si lo salta).
 * - NO normaliza a E.164 completo (requiere country code del hotel — fuera de scope F3).
 *   Caller debe pasar phone ya con country code; solo limpiamos formato.
 */
export function normalizePhone(phone: string | null | undefined): string {
  return (phone ?? '').replace(/\D+/g, '')
}

/** Helper compuesto: normaliza + hashea email. Devuelve null si vacío. */
export async function hashEmail(email: string | null | undefined): Promise<string | null> {
  return hashSha256(normalizeEmail(email))
}

/** Helper compuesto: normaliza + hashea phone. Devuelve null si vacío o sin dígitos. */
export async function hashPhone(phone: string | null | undefined): Promise<string | null> {
  const normalized = normalizePhone(phone)
  if (!normalized) return null
  return hashSha256(normalized)
}

/** Objeto exportado para inyección/mocking si el caller prefiere ese estilo (opcional). */
export const enhancedConversions = {
  hashSha256,
  normalizeEmail,
  normalizePhone,
  hashEmail,
  hashPhone,
}
