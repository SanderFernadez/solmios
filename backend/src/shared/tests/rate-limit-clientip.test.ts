// SEC-4.1 — getClientIp: la IP para el rate limit no debe ser forjable por el cliente.
import { describe, it, expect } from 'bun:test'
import { getClientIp } from '../middlewares/rate-limit'

function reqWith(headers: Record<string, any>, remoteAddress?: string): any {
  return { headers, remoteAddress }
}

describe('getClientIp (SEC-4.1)', () => {
  it('prefiere CF-Connecting-IP (Cloudflare, no forjable a través de CF)', () => {
    const req = reqWith({ 'cf-connecting-ip': '9.9.9.9', 'x-forwarded-for': '1.1.1.1, 2.2.2.2' })
    expect(getClientIp(req)).toBe('9.9.9.9')
  })

  it('sin CF, usa la ÚLTIMA IP de XFF (la agrega el proxy), no la primera forjable', () => {
    // Un atacante pone 'fake-spoofed' primero para rotar el bucket; nginx agrega la real al final.
    const req = reqWith({ 'x-forwarded-for': 'fake-spoofed, 8.8.8.8' })
    expect(getClientIp(req)).toBe('8.8.8.8')
  })

  it('sin proxy (dev local), cae a remoteAddress', () => {
    expect(getClientIp(reqWith({}, '127.0.0.1'))).toBe('127.0.0.1')
  })

  it('sin ninguna señal, devuelve unknown', () => {
    expect(getClientIp(reqWith({}))).toBe('unknown')
  })
})
