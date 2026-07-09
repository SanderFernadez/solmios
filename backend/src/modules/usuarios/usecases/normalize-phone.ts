// usuarios/usecases/normalize-phone.ts — Normalización de teléfonos para el login.
//
// El login acepta email o teléfono. Los teléfonos se guardan sin formato canónico
// (`809-555-0001`, `(809) 555-0001`, `+1 809 555 0001`), así que hay que comparar
// formas normalizadas de ambos lados, no strings crudos.

/** Longitud de un número NANP sin código de país (RD, USA, Canadá). */
const NANP_LENGTH = 10

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
