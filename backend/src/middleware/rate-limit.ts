// Simple in-memory rate limiter for login attempts
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
