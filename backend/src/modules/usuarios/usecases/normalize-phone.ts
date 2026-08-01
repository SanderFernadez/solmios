// usuarios/usecases/normalize-phone.ts — Normalización de teléfonos para el login.
//
// El login acepta email o teléfono. Los teléfonos se guardan sin formato canónico
// (`809-555-0001`, `(809) 555-0001`, `+1 809 555 0001`), así que hay que comparar
// formas normalizadas de ambos lados, no strings crudos.
import { ValidationError } from 'arckode-framework'

/** Longitud de un número NANP sin código de país (RD, USA, Canadá). */
const NANP_LENGTH = 10

// #582: rango de dígitos válido para PERSISTIR un teléfono (E.164: 7-15). `normalizePhone`
// (login, comparación) NO valida — solo limpia; `toStoredPhone` (persistencia) sí, para que un
// teléfono basura (ej. 26 dígitos repetidos) no llegue a la DB. El frontend (FormModal) ya valida
// 10-15 en la UI; acá el backend defiende el rango internacional completo.
const MIN_PHONE_DIGITS = 7
const MAX_PHONE_DIGITS = 15

/** Código de país del plan de numeración norteamericano. */
const NANP_COUNTRY_CODE = '1'

/**
 * Reduce un teléfono a solo sus dígitos significativos.
 *
 * Descarta separadores y, cuando el número tiene 11 dígitos y arranca en `1`,
 * descarta ese `1` inicial: en NANP es el código de país, no parte del número.
 * Sin esto, `+1 809 555 0001` (lo que uno escribe) nunca coincide con
 * `809-555-0001` (lo que está en la base).
 *
 * Devuelve `''` si no hay dígitos — el llamador DEBE tratar eso como entrada inválida.
 */
export function normalizePhone(raw: string): string {
  const digits = raw.replace(/\D/g, '')
  if (digits.length === NANP_LENGTH + 1 && digits.startsWith(NANP_COUNTRY_CODE)) {
    return digits.slice(1)
  }
  return digits
}

/** ¿La entrada parece un teléfono y no un email? Solo dígitos y separadores. */
export function looksLikePhone(raw: string): boolean {
  return /^[\d\s\-()+]+$/.test(raw)
}

/**
 * Forma en que el teléfono se PERSISTE: dígitos planos, sin separadores ni código
 * de país (`8095550001`). El formato de presentación es cosa de la UI.
 *
 * Devuelve un objeto parcial a propósito: si no vino `phone` no devuelve la clave,
 * para que un update parcial no borre el teléfono que ya estaba guardado.
 */
export function toStoredPhone(raw: unknown): { phone?: string } {
  if (raw === undefined || raw === null) return {}
  const value = String(raw).trim()
  if (value === '') return { phone: '' }
  const digits = normalizePhone(value)
  // #582: delimitar antes de persistir. Un teléfono con dígitos fuera del rango E.164 (7-15) es
  // basura (ej. 26 dígitos repetidos) y no debe guardarse — era el riesgo de "error en la DB" del
  // feedback. El login usa `normalizePhone` directo (no esto), así que la comparación no cambia.
  if (digits.length < MIN_PHONE_DIGITS || digits.length > MAX_PHONE_DIGITS) {
    throw new ValidationError(
      `Teléfono inválido: debe tener entre ${MIN_PHONE_DIGITS} y ${MAX_PHONE_DIGITS} dígitos (recibí ${digits.length}).`,
    )
  }
  return { phone: digits }
}
