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
 * IP real del cliente para el rate limit. Orden de confianza (SEC-4.1):
 * 1. `CF-Connecting-IP`: Cloudflare la setea con la IP real y la sobrescribe en el borde
 *    (no forjable a través de CF). Es la fuente correcta en este deploy (Cloudflare → nginx).
 * 2. ÚLTIMA IP de `X-Forwarded-For`: la agrega el proxy confiable (nginx). La PRIMERA la puede
 *    forjar el cliente para rotar el bucket y saltarse el límite → NO se usa la primera.
 * 3. `remoteAddress`: fallback en dev/local sin proxy.
 */
export function getClientIp(req: HttpRequest): string {
  const cf = req.headers?.['cf-connecting-ip']
  if (cf) { const ip = String(cf).trim(); if (ip) return ip }
  const xff = req.headers?.['x-forwarded-for']
  if (xff) {
    const parts = String(xff).split(',').map((s) => s.trim()).filter(Boolean)
    if (parts.length) return parts[parts.length - 1]
  }
  return req.remoteAddress || 'unknown'
}
