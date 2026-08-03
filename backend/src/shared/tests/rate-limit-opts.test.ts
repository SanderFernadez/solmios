// F0 (carta-experiencia-avanzada, D13) — rateLimit(key, opts?) extendido debe ser
// 100% retrocompatible con los 6 call-sites reales de usuarios/index.ts que llaman
// rateLimit(key) sin segundo argumento: login:{ip} (línea 51), verify-email:{ip}
// (línea 77), resend-verif:{userId|ip} (línea 82), forgot-password:{ip} (línea 93),
// reset-password:{ip} (línea 101), create-user:{ip} (línea 123).
import { describe, it, expect } from 'bun:test'
import { rateLimit } from '../middlewares/rate-limit'

describe('rateLimit(key, opts?) — F0 extensión retrocompatible', () => {
  it('sin opts: 20 llamadas permiten, la 21ª bloquea con retryAfter (reproduce los 6 call-sites reales)', async () => {
    const key = `login:${crypto.randomUUID()}`
    for (let i = 0; i < 20; i++) {
      const { allowed } = await rateLimit(key)
      expect(allowed).toBe(true)
    }
    const blocked = await rateLimit(key)
    expect(blocked.allowed).toBe(false)
    expect(blocked.retryAfter).toBeGreaterThan(0)
  })

  it('con opts={maxAttempts:120, windowMs:300000}: una key distinta permite 120 intentos sin afectar keys sin opts', async () => {
    const publicKey = `public-menu:${crypto.randomUUID()}`
    const otherKey = `login:${crypto.randomUUID()}`

    for (let i = 0; i < 120; i++) {
      const { allowed } = await rateLimit(publicKey, { maxAttempts: 120, windowMs: 300000 })
      expect(allowed).toBe(true)
    }
    const blocked = await rateLimit(publicKey, { maxAttempts: 120, windowMs: 300000 })
    expect(blocked.allowed).toBe(false)
    expect(blocked.retryAfter).toBeGreaterThan(0)

    // La key sin opts (bucket independiente) sigue permitiendo sus 20 intentos normales
    for (let i = 0; i < 20; i++) {
      const { allowed } = await rateLimit(otherKey)
      expect(allowed).toBe(true)
    }
    const otherBlocked = await rateLimit(otherKey)
    expect(otherBlocked.allowed).toBe(false)
  })

  it('ventana expira: tras windowMs, el contador resetea (mismo criterio ya implementado)', async () => {
    const key = `reset-password:${crypto.randomUUID()}`
    const shortWindow = 50 // ms

    for (let i = 0; i < 3; i++) {
      const { allowed } = await rateLimit(key, { maxAttempts: 3, windowMs: shortWindow })
      expect(allowed).toBe(true)
    }
    expect((await rateLimit(key, { maxAttempts: 3, windowMs: shortWindow })).allowed).toBe(false)

    await new Promise((resolve) => setTimeout(resolve, shortWindow + 20))

    // Ventana expirada: el contador resetea, permite de nuevo
    expect((await rateLimit(key, { maxAttempts: 3, windowMs: shortWindow })).allowed).toBe(true)
  })
})
