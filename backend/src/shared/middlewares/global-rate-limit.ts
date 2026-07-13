// shared/middlewares/global-rate-limit.ts — SEC-4.2
// Límite global por IP para TODA la API (anti-abuso / anti-flood). Separado del limiter de
// login (más estricto): este es un techo amplio para frenar ráfagas automatizadas.
// Keyed por getClientIp (SEC-4.1: IP no forjable). In-memory por ahora; el store distribuido
// llega con RL-01 (#316) — la interfaz no cambia.
import type { MiddlewareHandler } from 'arckode-framework'
import { getClientIp } from './rate-limit'

const buckets = new Map<string, { count: number; resetAt: number }>()
const DEFAULT_MAX = Number(process.env.GLOBAL_RATE_MAX) || 300 // req por ventana
const WINDOW_MS = 60_000 // 1 min
const SWEEP_MS = 5 * 60_000
const MS_TO_SEC = 1000

setInterval(() => {
  const now = Date.now()
  for (const [k, r] of buckets) if (now > r.resetAt) buckets.delete(k)
}, SWEEP_MS)

/** Middleware global de rate limit por IP. `maxPerWindow` configurable (default env/300). */
export function globalRateLimit(maxPerWindow = DEFAULT_MAX): MiddlewareHandler {
  return async (req: any, next: any) => {
    const ip = getClientIp(req)
    const now = Date.now()
    const rec = buckets.get(ip)
    if (!rec || now > rec.resetAt) {
      buckets.set(ip, { count: 1, resetAt: now + WINDOW_MS })
    } else if (rec.count >= maxPerWindow) {
      const retryAfter = Math.ceil((rec.resetAt - now) / MS_TO_SEC)
      return { status: 429, headers: { 'Retry-After': String(retryAfter) }, body: { error: 'Demasiadas solicitudes' } }
    } else {
      rec.count++
    }
    return next(req)
  }
}

/** Test-only: limpia los buckets. */
export function _resetGlobalRateLimit(): void {
  buckets.clear()
}
