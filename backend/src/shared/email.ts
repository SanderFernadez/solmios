// email.ts — Validación de direcciones de correo.
//
// El alta chequeaba `email.includes('@')`, que acepta "a@", "@b" y "a@b" como
// direcciones válidas. Como el email ES la credencial de login y el destino de
// los avisos, una dirección imposible deja una cuenta a la que nadie puede
// entrar ni recuperar.

/**
 * Forma general de una dirección: algo, arroba, dominio con al menos un punto y
 * un TLD de 2+ letras. Deliberadamente NO intenta implementar el RFC 5322
 * completo —esa expresión es enorme y termina rechazando direcciones legítimas—
 * sino descartar lo que es claramente imposible.
 *
 * Lo único que prueba de verdad que una dirección existe es mandarle un correo;
 * de eso se ocupa la verificación de email (tarea aparte).
 */
const EMAIL_RE = /^[^\s@,;:<>()[\]\\]+@[^\s@.]+(\.[^\s@.]+)*\.[A-Za-z]{2,}$/

/** Tope defensivo: 254 es el máximo de una dirección según el RFC 5321. */
export const EMAIL_MAX = 254

export function isValidEmail(email: unknown): boolean {
  const e = String(email ?? '').trim()
  if (!e || e.length > EMAIL_MAX) return false
  // Dos puntos seguidos no forman una etiqueta de dominio válida y el regex de
  // arriba, al permitir sub-dominios, los dejaría pasar.
  if (e.includes('..')) return false
  return EMAIL_RE.test(e)
}

/** Normaliza para guardar y comparar: el login no distingue mayúsculas. */
export function normalizeEmail(email: unknown): string {
  return String(email ?? '').trim().toLowerCase()
}
