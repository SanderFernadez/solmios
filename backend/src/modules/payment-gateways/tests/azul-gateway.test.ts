// modules/payment-gateways/tests/azul-gateway.test.ts
//
// Cubre el adapter de Azul Payment Page (services/payment-gateway/azul-gateway.ts). No hay
// sandbox real contra el que probar: estos tests validan que ESTE código arma y verifica el hash
// como el propio adapter lo define (buildAuthHash/verifyReturnHash), no contra un fixture de Azul.

import { describe, it, expect } from 'bun:test'
import { createHash } from 'node:crypto'
import {
  AzulGateway,
  buildAuthHash,
  verifyReturnHash,
  type AzulPaymentPageFields,
  type AzulReturnFields,
} from '../../../services/payment-gateway/azul-gateway'

const creds = { merchantId: 'MERCH123', authKey: 'super-secreta', currency: 'usd' }

function gw() {
  return new AzulGateway(creds, 'test')
}

describe('AzulGateway — capacidades', () => {
  it('declara confirmation "return" y NO refund/void (Payment Page no los soporta)', () => {
    const g = gw()
    expect(g.capabilities.confirmation).toBe('return')
    expect(g.capabilities.refund).toBe(false)
    expect(g.capabilities.void).toBe(false)
  })

  it('exige merchantId y authKey al construir', () => {
    expect(() => new AzulGateway({ merchantId: '', authKey: 'x' } as any, 'test')).toThrow(/merchantId/)
    expect(() => new AzulGateway({ merchantId: 'x', authKey: '' } as any, 'test')).toThrow(/authKey/)
  })
})

describe('AzulGateway — createCharge (charge "exitoso" = arma el redirect)', () => {
  it('arma la URL de Payment Page con AuthHash y providerRef = la referencia nuestra', async () => {
    const g = gw()
    const res = await g.createCharge({
      hotelId: 'h1', amountMinor: 150000, currency: 'usd', description: 'Depósito reserva',
      reference: 'RES-001', successUrl: 'https://hotel.test/ok', cancelUrl: 'https://hotel.test/cancel',
    })
    expect(res.status).toBe('redirect')
    if (res.status !== 'redirect') throw new Error('unreachable')
    expect(res.providerRef).toBe('RES-001')
    expect(res.redirectUrl).toContain('pruebas.azul.com.do') // host de test, no de producción
    expect(res.redirectUrl).toContain('AuthHash=')
    expect(res.redirectUrl).toContain('OrderNumber=RES-001')
  })
})

describe('AzulGateway — hash de ida/vuelta (funciones puras)', () => {
  const fields: AzulPaymentPageFields = {
    MerchantId: 'MERCH123', MerchantName: 'SolmiOS', MerchantType: 'ECommerce',
    CurrencyCode: 'USD', OrderNumber: 'RES-001', Amount: '150000', ITBIS: '0',
    ApprovedUrl: 'https://hotel.test/ok', DeclinedUrl: 'https://hotel.test/cancel', CancelUrl: 'https://hotel.test/cancel',
  }

  it('buildAuthHash es determinístico (misma entrada → mismo hash)', () => {
    const h1 = buildAuthHash(fields, 'llave')
    const h2 = buildAuthHash(fields, 'llave')
    expect(h1).toBe(h2)
    expect(h1).toMatch(/^[0-9A-F]{128}$/) // SHA-512 hex en mayúsculas
  })

  it('cambia con la llave (dos comercios distintos jamás producen el mismo hash)', () => {
    expect(buildAuthHash(fields, 'llaveA')).not.toBe(buildAuthHash(fields, 'llaveB'))
  })
})

describe('AzulGateway — confirm() (hash válido / inválido en el retorno)', () => {
  function returnFields(overrides: Partial<AzulReturnFields> = {}): AzulReturnFields {
    const base: Omit<AzulReturnFields, 'AuthHash'> = {
      OrderNumber: 'RES-001', Amount: '150000', ResponseCode: 'Approved',
      AuthorizationCode: 'AUTH1', IsoCode: '00', RRN: 'RRN1', AzulOrderId: 'AZUL-999',
    }
    const merged = { ...base, ...overrides } as AzulReturnFields
    if (!('AuthHash' in overrides)) merged.AuthHash = verifyHashFor(merged, creds.authKey)
    return merged
  }
  function verifyHashFor(f: AzulReturnFields, authKey: string): string {
    // Reproduce exactamente la fórmula de verifyReturnHash para armar un retorno "auténtico" en el test.
    return createHash('sha512')
      .update([f.OrderNumber, f.Amount, f.ResponseCode, f.AuthorizationCode || '', f.IsoCode || '', f.RRN || '', authKey].join(''), 'utf8')
      .digest('hex').toUpperCase()
  }

  it('hash VÁLIDO + ResponseCode aprobado → paid', async () => {
    const g = gw()
    const f = returnFields()
    const outcome = await g.confirm({ hotelId: 'h1', query: f as unknown as Record<string, string> })
    expect(outcome).not.toBeNull()
    expect(outcome?.status).toBe('paid')
    expect(outcome?.reference).toBe('RES-001')
    expect(outcome?.amountMinor).toBe(150000)
  })

  it('hash VÁLIDO + ResponseCode rechazado → failed', async () => {
    const g = gw()
    const f = returnFields({ ResponseCode: 'Declined' })
    const outcome = await g.confirm({ hotelId: 'h1', query: f as unknown as Record<string, string> })
    expect(outcome?.status).toBe('failed')
  })

  it('hash INVÁLIDO (manipulado) → null, NUNCA se confía en el retorno', async () => {
    const g = gw()
    const f = returnFields({ AuthHash: 'HASH-FALSO-INVENTADO' })
    const outcome = await g.confirm({ hotelId: 'h1', query: f as unknown as Record<string, string> })
    expect(outcome).toBeNull()
  })

  it('sin AuthHash en la query → null', async () => {
    const g = gw()
    const outcome = await g.confirm({ hotelId: 'h1', query: { OrderNumber: 'RES-001' } })
    expect(outcome).toBeNull()
  })

  it('verifyReturnHash rechaza un monto alterado (mismo truco que cambiar el precio en la URL)', () => {
    const f = returnFields()
    const tampered = { ...f, Amount: '1' } // el atacante bajó el monto pero no puede recalcular el hash real
    expect(verifyReturnHash(tampered, creds.authKey)).toBe(false)
    expect(verifyReturnHash(f, creds.authKey)).toBe(true)
  })
})
