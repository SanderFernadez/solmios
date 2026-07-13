// Simple in-memory rate limiter for login attempts
import type { HttpRequest } from 'arckode-framework'

const attempts = new Map<string, { count: number; resetAt: number }>()

const MAX_ATTEMPTS = 20
const WINDOW_MS = 5 * 60 * 1000 // 5 minutes
const MS_TO_SEC = 1000
const SWEEP_INTERVAL_MS = 5 * 60 * 1000 // cleanup every 5 min

// Periodic cleanup to prevent memory leak
setInterval(() => {
  const now = Date.now()
  for (const [key, record] of attempts) {
    if (now > record.resetAt) attempts.delete(key)
  }
}, SWEEP_INTERVAL_MS)

export function rateLimit(key: string): { allowed: boolean; retryAfter?: number } {
  const now = Date.now()
  const record = attempts.get(key)

  if (!record || now > record.resetAt) {
    attempts.set(key, { count: 1, resetAt: now + WINDOW_MS })
    return { allowed: true }
  }

  if (record.count >= MAX_ATTEMPTS) {
    const retryAfter = Math.ceil((record.resetAt - now) / MS_TO_SEC)
    return { allowed: false, retryAfter }
  }

  record.count++
  return { allowed: true }
}

export function recordFailedAttempt(key: string): { allowed: boolean; retryAfter?: number } {
  return rateLimit(key)
}

export function resetAttempts(key: string): void {
  attempts.delete(key)
}

/**
 * IP real del cliente detrás de nginx (reverse proxy): nginx reenvía la conexión
 * TCP original desde localhost, así que `req.remoteAddress` sería siempre 127.0.0.1
 * para TODOS los clientes — inútil como key de rate limit. `X-Forwarded-For` trae la
 * cadena de IPs que atravesó el request; la primera es la del cliente real.
 * Fallback a `remoteAddress` cuando no hay proxy (dev local) o el header viene vacío.
 */
export function getClientIp(req: HttpRequest): string {
  const xff = req.headers?.['x-forwarded-for']
  if (xff) {
    const first = xff.split(',')[0]?.trim()
    if (first) return first
  }
  return req.remoteAddress || 'unknown'
}
