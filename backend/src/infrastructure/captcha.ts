// captcha.ts — Verificación de Cloudflare Turnstile para el alta pública.
//
// El alta es la única puerta abierta que escribe en la base. El rate-limit por
// IP frena la fuerza bruta desde una máquina, pero no a un bot distribuido
// creando hoteles basura. El captcha cubre eso.
//
// Turnstile y no reCAPTCHA porque el dominio ya está detrás de Cloudflare, es
// gratis sin límite de verificaciones y no perfila al visitante.
//
// Configuración: `TURNSTILE_SECRET` en el .env del backend (no va al repo) y
// `VITE_TURNSTILE_SITE_KEY` en el build del frontend. La site key es pública;
// el secret NO.

const VERIFY_URL = 'https://challenges.cloudflare.com/turnstile/v0/siteverify'

/** Si la verificación de Cloudflare no responde en este tiempo, se corta. */
const TIMEOUT_MS = 8000

/**
 * ¿Hay captcha configurado? Sin secret el sistema NO exige token.
 *
 * Es deliberado: permite levantar el proyecto en local y desplegar el código
 * antes de cargar las claves, sin romper el alta. El precio es que si alguien
 * borra el secret en producción el captcha se apaga en silencio, así que el
 * arranque lo avisa por log (composition-root).
 */
export function isCaptchaEnabled(): boolean {
  return Boolean(process.env.TURNSTILE_SECRET)
}

export interface CaptchaResult {
  ok: boolean
  /** Motivo para el log. No se le muestra al visitante. */
  reason?: string
}

/**
 * Valida el token contra Cloudflare. Devuelve `ok:false` en vez de tirar: para
 * quien intenta registrarse, un captcha inválido es un error de formulario, no
 * una caída del servidor.
 *
 * `remoteIp` es opcional pero recomendado: Cloudflare lo usa para puntuar.
 */
export async function verifyCaptcha(token: string, remoteIp?: string): Promise<CaptchaResult> {
  const secret = process.env.TURNSTILE_SECRET
  if (!secret) return { ok: true, reason: 'captcha deshabilitado (sin TURNSTILE_SECRET)' }
  if (!token) return { ok: false, reason: 'token vacío' }

  const body = new URLSearchParams({ secret, response: token })
  if (remoteIp) body.set('remoteip', remoteIp)

  // AbortController y no confiar en el timeout del runtime: sin esto, una
  // demora de Cloudflare cuelga el request del alta hasta que el cliente corta.
  const ctrl = new AbortController()
  const timer = setTimeout(() => ctrl.abort(), TIMEOUT_MS)
  try {
    const res = await fetch(VERIFY_URL, {
      method: 'POST',
      body,
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      signal: ctrl.signal,
    })
    if (!res.ok) return { ok: false, reason: `siteverify HTTP ${res.status}` }
    const data = (await res.json()) as { success?: boolean; 'error-codes'?: string[] }
    if (data.success) return { ok: true }
    return { ok: false, reason: (data['error-codes'] ?? ['sin detalle']).join(',') }
  } catch (err) {
    // Cloudflare caído o timeout. Se RECHAZA en vez de dejar pasar: si el
    // captcha está activado es porque el alta necesita esa barrera, y abrirla
    // ante un fallo de red la vuelve inútil justo cuando hay un ataque.
    const reason = (err as Error)?.name === 'AbortError' ? 'timeout' : String((err as Error)?.message ?? err)
    return { ok: false, reason: `siteverify inaccesible: ${reason}` }
  } finally {
    clearTimeout(timer)
  }
}
