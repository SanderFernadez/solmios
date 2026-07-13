// SEC-4.2 — el limiter global corta ráfagas por IP y deja pasar IPs distintas.
import { describe, it, expect, beforeEach } from 'bun:test'
import { globalRateLimit, _resetGlobalRateLimit } from '../middlewares/global-rate-limit'

const next = async () => ({ status: 200, body: { ok: true } })
const reqFrom = (ip: string): any => ({ headers: { 'cf-connecting-ip': ip } })

describe('globalRateLimit (SEC-4.2)', () => {
  beforeEach(() => _resetGlobalRateLimit())

  it('deja pasar hasta el límite y corta con 429 al excederlo', async () => {
    const mw = globalRateLimit(2)
    const req = reqFrom('1.1.1.1')
    expect((await mw(req, next)).status).toBe(200)
    expect((await mw(req, next)).status).toBe(200)
    const blocked = await mw(req, next)
    expect(blocked.status).toBe(429)
    expect(blocked.headers?.['Retry-After']).toBeDefined()
  })

  it('cada IP tiene su propio bucket', async () => {
    const mw = globalRateLimit(1)
    expect((await mw(reqFrom('1.1.1.1'), next)).status).toBe(200)
    expect((await mw(reqFrom('2.2.2.2'), next)).status).toBe(200) // otra IP, no afectada
    expect((await mw(reqFrom('1.1.1.1'), next)).status).toBe(429) // misma IP, excedida
  })
})
