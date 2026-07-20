// password-policy.ts — Única definición de "contraseña aceptable".
//
// Antes cada puerta pedía algo distinto: el alta pública exigía 8 caracteres y
// la creación de usuarios del equipo 6, así que la política real del sistema era
// la más floja de todas. Acá vive la regla y todos los puntos que fijan una
// contraseña la importan.
//
// El espejo en el frontend (composables/usePasswordStrength.ts) existe solo para
// dar feedback mientras se escribe: la validación que cuenta es esta, porque el
// cliente se puede saltear.

/** Mínimo real. Por encima de los 8 típicos: 8 con diccionario cae rápido. */
export const PASSWORD_MIN = 10

/**
 * Tope. No es una regla de seguridad sino de disponibilidad: hashear una
 * contraseña de megabytes es un DoS barato contra el servidor.
 */
export const PASSWORD_MAX = 128

/**
 * Las que aparecen primero en cualquier ataque de diccionario. No pretende ser
 * exhaustiva —para eso haría falta una lista de millones— pero corta el caso
 * habitual de "le pongo cualquier cosa para entrar rápido".
 */
const COMMON = new Set([
  'password', 'password1', 'password123', 'contrasena', 'contraseña',
  '12345678', '123456789', '1234567890', 'qwertyuiop', 'qwerty123',
  'admin1234', 'administrador', 'bienvenido', 'welcome123', 'iloveyou',
  'hotel1234', 'hotelhotel', 'demo1234', 'letmein123', 'abc12345',
])

/** Normaliza para comparar: sin acentos, minúsculas, sin separadores. */
function norm(s: string): string {
  return s.toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/[\s._-]/g, '')
}

export interface PasswordContext {
  /** Email de la cuenta: la parte antes de la @ no puede ser la contraseña. */
  email?: string
  /** Nombre del hotel o de la persona. */
  name?: string
}

/**
 * Devuelve TODOS los motivos por los que la contraseña no sirve, en español y
 * listos para mostrar. Vacío = aceptable.
 *
 * Se devuelven todos juntos a propósito: corregir de a un error por intento es
 * lo que empuja a la gente a poner "Password1!" y terminar.
 */
export function passwordIssues(password: string, ctx: PasswordContext = {}): string[] {
  const issues: string[] = []
  const pwd = String(password ?? '')

  if (pwd.length < PASSWORD_MIN) issues.push(`Debe tener al menos ${PASSWORD_MIN} caracteres`)
  if (pwd.length > PASSWORD_MAX) issues.push(`No puede superar los ${PASSWORD_MAX} caracteres`)
  if (!/[a-záéíóúñ]/.test(pwd)) issues.push('Debe incluir una letra minúscula')
  if (!/[A-ZÁÉÍÓÚÑ]/.test(pwd)) issues.push('Debe incluir una letra mayúscula')
  if (!/[0-9]/.test(pwd)) issues.push('Debe incluir un número')

  const n = norm(pwd)
  if (COMMON.has(n)) issues.push('Es una contraseña demasiado común')

  // Una sola letra o dígito repetido pasa las reglas de composición de arriba
  // si se le suma una mayúscula y un número ("Aaaaaaaaa1"), pero no protege nada.
  if (/^(.)\1+$/.test(pwd)) issues.push('No puede ser el mismo carácter repetido')

  // La contraseña no puede ser el propio email ni el nombre: son públicos y son
  // lo primero que prueba quien ataca una cuenta puntual.
  const local = norm(String(ctx.email ?? '').split('@')[0] ?? '')
  if (local.length >= 4 && n.includes(local)) issues.push('No puede contener tu email')

  const name = norm(String(ctx.name ?? ''))
  if (name.length >= 4 && n.includes(name)) issues.push('No puede contener el nombre de la cuenta')

  return issues
}

/** ¿Sirve? Azúcar sobre `passwordIssues` para condicionales. */
export function isStrongPassword(password: string, ctx: PasswordContext = {}): boolean {
  return passwordIssues(password, ctx).length === 0
}
