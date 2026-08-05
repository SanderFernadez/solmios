// #658: /api/auth/* debe tener su propio cupo, separado del resto del panel — antes compartían
// un solo contador de 200/min y la navegación normal (varios GETs por pantalla) lo agotaba.
import { describe, it, expect } from 'bun:test'
import type { HttpRequest, HttpResponse } from 'arckode-framework'
import { scopedRateLimit } from '../scoped-rate-limit'

function req(path: string): HttpRequest {
  return { id: 'r1', method: 'GET', path, params: {}, query: {}, headers: {}, body: undefined } as HttpRequest
}
const next = async (): Promise<HttpResponse> => ({ status: 200, body: {} }) as HttpResponse

describe('scopedRateLimit', () => {
  it('un path que NO matchea pasa siempre, sin contar contra el límite del path que sí matchea', async () => {
    const mw = scopedRateLimit((p) => p.startsWith('/api/auth'), { windowMs: 60_000, max: 2, keyBy: () => 'ip1' })
    for (let i = 0; i < 10; i++) {
      const res = await mw(req('/api/reservas'), next)
      expect(res.status).toBe(200)
    }
  })

  it('un path que matchea respeta el límite bajo y corta al superarlo', async () => {
    const mw = scopedRateLimit((p) => p.startsWith('/api/auth'), { windowMs: 60_000, max: 2, keyBy: () => 'ip2' })
    await mw(req('/api/auth/login'), next)
    await mw(req('/api/auth/login'), next)
    await expect(mw(req('/api/auth/login'), next)).rejects.toThrow(/too many/i)
  })

  it('dos scopes distintos no comparten contador (auth agotado no bloquea el resto)', async () => {
    const authLimiter = scopedRateLimit((p) => p.startsWith('/api/auth'), { windowMs: 60_000, max: 1, keyBy: () => 'ip3' })
    const panelLimiter = scopedRateLimit((p) => !p.startsWith('/api/auth'), { windowMs: 60_000, max: 5, keyBy: () => 'ip3' })
    await authLimiter(req('/api/auth/login'), next)
    await expect(authLimiter(req('/api/auth/login'), next)).rejects.toThrow(/too many/i)
    // El panel sigue andando con su propio cupo, aunque auth ya se haya agotado para la misma IP.
    const res = await panelLimiter(req('/api/reservas'), next)
    expect(res.status).toBe(200)
  })
})
