// modules/payment-gateways/tests/cardnet-gateway.test.ts
//
// Cubre el adapter de CardNet Ztrans (services/payment-gateway/cardnet-gateway.ts) mockeando
// `fetch` global. Sin sandbox real: los mocks tienen la forma que EL PROPIO adapter espera
// (CardnetStatusResponse), no una forma verificada contra la documentación oficial de CardNet.

import { describe, it, expect, beforeEach, afterEach } from 'bun:test'
import {
  CardnetGateway,
  signChargeRequest,
  signStatusQuery,
  type CardnetChargeFields,
} from '../../../services/payment-gateway/cardnet-gateway'

const creds = { comercio: 'COMERCIO1', terminal: 'TERM1', llave: 'llave-secreta', currency: 'dop' }

function gw() {
  return new CardnetGateway(creds, 'test')
}

const originalFetch = globalThis.fetch

afterEach(() => {
  globalThis.fetch = originalFetch
})

describe('CardnetGateway — capacidades y validación de credenciales', () => {
  it('declara confirmation "pull" y SÍ soporta refund/void', () => {
    const g = gw()
    expect(g.capabilities.confirmation).toBe('pull')
    expect(g.capabilities.refund).toBe(true)
    expect(g.capabilities.void).toBe(true)
  })

  it('exige comercio, terminal y llave al construir', () => {
    expect(() => new CardnetGateway({ comercio: '', terminal: 'T', llave: 'L' } as any, 'test')).toThrow(/comercio/)
    expect(() => new CardnetGateway({ comercio: 'C', terminal: '', llave: 'L' } as any, 'test')).toThrow(/terminal/)
    expect(() => new CardnetGateway({ comercio: 'C', terminal: 'T', llave: '' } as any, 'test')).toThrow(/llave/)
  })
})

describe('CardnetGateway — createCharge (arma el redirect firmado)', () => {
  it('arma la URL de Ztrans con la firma y providerRef = nuestra referencia', async () => {
    const g = gw()
    const res = await g.createCharge({
      hotelId: 'h1', amountMinor: 250000, currency: 'dop', description: 'Pago de folio',
      reference: 'FOLIO-42', successUrl: 'https://hotel.test/ok', cancelUrl: 'https://hotel.test/cancel',
    })
    expect(res.status).toBe('redirect')
    if (res.status !== 'redirect') throw new Error('unreachable')
    expect(res.providerRef).toBe('FOLIO-42')
    expect(res.redirectUrl).toContain('qacardnet.cardnet.com.do') // host de test
    expect(res.redirectUrl).toContain('Firma=')
    expect(res.redirectUrl).toContain('TrxToken=FOLIO-42')
  })
})

describe('CardnetGateway — firma (funciones puras)', () => {
  const fields: CardnetChargeFields = {
    Comercio: 'COMERCIO1', Terminal: 'TERM1', TrxToken: 'FOLIO-42', Monto: '250000', Moneda: 'DOP', ReturnUrl: 'https://h.test/ok',
  }

  it('signChargeRequest es determinístico y cambia con la llave', () => {
    expect(signChargeRequest(fields, 'llaveA')).toBe(signChargeRequest(fields, 'llaveA'))
    expect(signChargeRequest(fields, 'llaveA')).not.toBe(signChargeRequest(fields, 'llaveB'))
  })
})

describe('CardnetGateway — confirm() vía consulta activa (modo pull)', () => {
  it('sin providerRef ni TrxToken en la query → null (nada que consultar)', async () => {
    const g = gw()
    const outcome = await g.confirm({ hotelId: 'h1' })
    expect(outcome).toBeNull()
  })

  it('consulta APROBADA (ResponseCode 00) → paid', async () => {
    globalThis.fetch = (async () => new Response(JSON.stringify({
      TrxToken: 'FOLIO-42', ResponseCode: '00', AuthorizationCode: 'AUTH1', Rrn: 'RRN1', Monto: '250000', Moneda: 'DOP',
    }), { status: 200 })) as any

    const g = gw()
    const outcome = await g.confirm({ hotelId: 'h1', providerRef: 'FOLIO-42' })
    expect(outcome).not.toBeNull()
    expect(outcome?.status).toBe('paid')
    expect(outcome?.reference).toBe('FOLIO-42')
    expect(outcome?.amountMinor).toBe(250000)
  })

  it('consulta RECHAZADA (ResponseCode distinto de 00) → failed', async () => {
    globalThis.fetch = (async () => new Response(JSON.stringify({
      TrxToken: 'FOLIO-42', ResponseCode: '05', // "declined" en la convención asumida
    }), { status: 200 })) as any

    const g = gw()
    const outcome = await g.confirm({ hotelId: 'h1', providerRef: 'FOLIO-42' })
    expect(outcome?.status).toBe('failed')
  })

  it('CardNet caído/host inalcanzable → null, NUNCA se asume pagado', async () => {
    globalThis.fetch = (async () => { throw new Error('ECONNREFUSED') }) as any
    const g = gw()
    const outcome = await g.confirm({ hotelId: 'h1', providerRef: 'FOLIO-42' })
    expect(outcome).toBeNull()
  })

  it('respuesta HTTP no-ok (4xx/5xx) → null', async () => {
    globalThis.fetch = (async () => new Response('error', { status: 500 })) as any
    const g = gw()
    const outcome = await g.confirm({ hotelId: 'h1', providerRef: 'FOLIO-42' })
    expect(outcome).toBeNull()
  })
})

describe('CardnetGateway — refund/void', () => {
  it('refund aprobado (ResponseCode 00) → status "approved"', async () => {
    globalThis.fetch = (async () => new Response(JSON.stringify({ RefundId: 'RF-1', ResponseCode: '00' }), { status: 200 })) as any
    const g = gw()
    const r = await g.refund('FOLIO-42', 100000)
    expect(r.status).toBe('approved')
    expect(r.refundId).toBe('RF-1')
  })

  it('refund rechazado por HTTP → tira (no se puede confiar en que el reembolso pasó)', async () => {
    globalThis.fetch = (async () => new Response(JSON.stringify({ message: 'saldo insuficiente' }), { status: 400 })) as any
    const g = gw()
    await expect(g.refund('FOLIO-42')).rejects.toThrow(/saldo insuficiente/)
  })

  it('voidCharge ok con HTTP 200', async () => {
    globalThis.fetch = (async () => new Response('{}', { status: 200 })) as any
    const g = gw()
    await expect(g.voidCharge('FOLIO-42')).resolves.toBeUndefined()
  })

  it('voidCharge tira si CardNet responde error', async () => {
    globalThis.fetch = (async () => new Response('{}', { status: 500 })) as any
    const g = gw()
    await expect(g.voidCharge('FOLIO-42')).rejects.toThrow(/anulación/)
  })
})

// signStatusQuery se ejercita indirectamente arriba (confirm/refund/void la usan); un smoke test
// directo alcanza para dejar documentada la firma pública.
describe('signStatusQuery', () => {
  it('es determinística', () => {
    expect(signStatusQuery('C', 'T', 'TRX', 'L')).toBe(signStatusQuery('C', 'T', 'TRX', 'L'))
  })
})
