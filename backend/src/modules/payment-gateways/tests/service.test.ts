// payment-gateways/tests/service.test.ts
// Usa repos mock — sin dependencia de SQLite ni Postgres.

import { describe, it, expect, beforeAll } from 'bun:test'
import { silentLogger } from 'arckode-framework/testing'
import { PaymentGatewaysService } from '../service'
import { PaymentGatewayRegistry } from '../../../services/payment-gateway/registry'
import { encryptCredentials, decryptCredentials } from '../../../services/payment-gateway/crypto'
import type { PaymentGatewayRow } from '../types'

const log = silentLogger()

beforeAll(() => {
  process.env.PAYMENTS_ENCRYPTION_KEY = 'test-master-key-de-al-menos-32-caracteres!!'
})

function memRepo(seed: PaymentGatewayRow[] = []) {
  const rows = [...seed]
  let n = 0
  return {
    rows,
    findMany: async (f: any = {}) => rows.filter(r =>
      Object.entries(f).every(([k, v]) => (r as any)[k] === v)),
    findById: async (id: string) => rows.find(r => r.id === id) || null,
    findOne: async (f: any) => rows.find(r => Object.entries(f).every(([k, v]) => (r as any)[k] === v)) || null,
    create: async (d: any) => { const row = { id: `gw${++n}`, ...d }; rows.push(row); return row },
    update: async (id: string, d: any) => { const r = rows.find(x => x.id === id); Object.assign(r as any, d) },
    delete: async (id: string) => { const i = rows.findIndex(r => r.id === id); if (i >= 0) rows.splice(i, 1) },
    count: async () => rows.length,
    paginate: async () => ({ data: rows, total: rows.length, limit: 20, offset: 0, pages: 1 }),
  } as any
}

function makeService(seed: PaymentGatewayRow[] = []) {
  const repo = memRepo(seed)
  const registry = new PaymentGatewayRegistry(repo, log)
  return { svc: new PaymentGatewaysService(repo, log, registry), repo, registry }
}

describe('crypto de credenciales', () => {
  it('cifra y descifra ida y vuelta', () => {
    const enc = encryptCredentials({ secretKey: 'sk_test_abc123', currency: 'usd' })
    expect(enc.startsWith('v1:')).toBe(true)
    expect(enc).not.toContain('sk_test_abc123') // el secreto NO aparece en el cifrado
    expect(decryptCredentials(enc)).toEqual({ secretKey: 'sk_test_abc123', currency: 'usd' })
  })

  it('rechaza un payload manipulado (AES-GCM autentica)', () => {
    const enc = encryptCredentials({ secretKey: 'sk_test_abc' })
    const p = enc.split(':')
    const tampered = [p[0], p[1], p[2], Buffer.from('otra-cosa').toString('base64')].join(':')
    expect(() => decryptCredentials(tampered)).toThrow()
  })
})

describe('PaymentGatewaysService', () => {
  it('guarda la credencial CIFRADA — nunca en texto plano en la fila', async () => {
    const { svc, repo } = makeService()
    await svc.upsert('h1', { provider: 'stripe', mode: 'test', secretKey: 'sk_test_SECRETO', enabled: true })
    const row = repo.rows[0]
    expect(row.credentials).not.toContain('sk_test_SECRETO')
    expect(decryptCredentials(row.credentials).secretKey).toBe('sk_test_SECRETO')
  })

  it('la API NUNCA devuelve el secreto: solo máscara y flags', async () => {
    const { svc } = makeService()
    await svc.upsert('h1', { provider: 'stripe', mode: 'test', secretKey: 'sk_test_1234567890abcdef', enabled: true })
    const [dto] = await svc.list('h1')
    expect(JSON.stringify(dto)).not.toContain('sk_test_1234567890abcdef')
    expect(dto.hasSecret).toBe(true)
    expect(dto.secretMask).toContain('…')
  })

  it('guardar sin re-tipear el secreto lo conserva', async () => {
    const { svc, repo } = makeService()
    await svc.upsert('h1', { provider: 'stripe', mode: 'test', secretKey: 'sk_test_original', enabled: true })
    // El dueño vuelve y solo cambia la moneda:
    await svc.upsert('h1', { provider: 'stripe', mode: 'test', currency: 'dop' })
    const creds = decryptCredentials(repo.rows[0].credentials)
    expect(creds.secretKey).toBe('sk_test_original')
    expect(creds.currency).toBe('dop')
  })

  it('rechaza una llave LIVE guardada en modo test (cobraría plata real)', async () => {
    const { svc } = makeService()
    await expect(
      svc.upsert('h1', { provider: 'stripe', mode: 'test', secretKey: 'sk_live_PELIGRO' }),
    ).rejects.toThrow(/PRODUCCIÓN/)
  })

  it('rechaza una llave TEST en modo live (ningún cobro sería real)', async () => {
    const { svc } = makeService()
    await expect(
      svc.upsert('h1', { provider: 'stripe', mode: 'live', secretKey: 'sk_test_nada' }),
    ).rejects.toThrow(/PRUEBA/)
  })

  it('declara que Azul NO soporta reembolsos (la UI no debe ofrecer el botón)', async () => {
    const { svc } = makeService()
    await svc.upsert('h1', { provider: 'azul', mode: 'test', secretKey: 'authkey-de-azul' })
    const [dto] = await svc.list('h1')
    expect(dto.capabilities.refund).toBe(false)
    expect(dto.capabilities.confirmation).toBe('return') // no tiene webhook
    expect(dto.implemented).toBe(false) // el puerto lo admite, falta el adapter
  })

  it('un solo default por hotel', async () => {
    const { svc, repo } = makeService()
    await svc.upsert('h1', { provider: 'stripe', mode: 'test', secretKey: 'sk_test_a', isDefault: true })
    await svc.upsert('h1', { provider: 'paypal', mode: 'test', secretKey: 'pp-secret', isDefault: true })
    const defaults = repo.rows.filter((r: PaymentGatewayRow) => r.isDefault)
    expect(defaults).toHaveLength(1)
    expect(defaults[0].provider).toBe('paypal')
  })
})

describe('PaymentGatewayRegistry — aislamiento entre hoteles', () => {
  it('el hotel A cobra con SUS llaves, nunca con las de B', async () => {
    const { svc, registry } = makeService()
    await svc.upsert('hotelA', { provider: 'stripe', mode: 'test', secretKey: 'sk_test_AAA', enabled: true })
    await svc.upsert('hotelB', { provider: 'stripe', mode: 'test', secretKey: 'sk_test_BBB', enabled: true })

    const gwA = await registry.resolve('hotelA') as any
    const gwB = await registry.resolve('hotelB') as any

    // Es el bug original: antes ambos resolvían a la MISMA cuenta (la del .env).
    expect(gwA.creds.secretKey).toBe('sk_test_AAA')
    expect(gwB.creds.secretKey).toBe('sk_test_BBB')
    expect(gwA.creds.secretKey).not.toBe(gwB.creds.secretKey)
  })

  it('una pasarela deshabilitada no se usa', async () => {
    delete process.env.STRIPE_SECRET_KEY // sin fallback global
    const { svc, registry } = makeService()
    await svc.upsert('h1', { provider: 'stripe', mode: 'test', secretKey: 'sk_test_x', enabled: false })
    expect(await registry.resolve('h1')).toBeNull()
  })

  it('invalida el cliente cacheado al cambiar la llave (sino sigue cobrando con la vieja)', async () => {
    const { svc, registry } = makeService()
    await svc.upsert('h1', { provider: 'stripe', mode: 'test', secretKey: 'sk_test_vieja', enabled: true })
    const before = await registry.resolve('h1') as any
    expect(before.creds.secretKey).toBe('sk_test_vieja')

    await svc.upsert('h1', { provider: 'stripe', mode: 'test', secretKey: 'sk_test_nueva' })
    const after = await registry.resolve('h1') as any
    expect(after.creds.secretKey).toBe('sk_test_nueva')
  })

  it('credenciales ilegibles → NO cae a la cuenta global (mejor no cobrar que cobrar mal)', async () => {
    process.env.STRIPE_SECRET_KEY = 'sk_test_GLOBAL_DE_LA_PLATAFORMA'
    const { registry } = makeService([{
      id: 'gw1', hotelId: 'h1', provider: 'stripe', mode: 'test',
      credentials: 'v1:basura:corrupta:ilegible', enabled: true, isDefault: true,
    } as PaymentGatewayRow])

    expect(await registry.resolve('h1')).toBeNull() // NO devuelve la pasarela global
    delete process.env.STRIPE_SECRET_KEY
  })
})
