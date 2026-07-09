// payment-requests/tests/payment-port.test.ts — Asiento del cobro Stripe en `payments`.
//
// Regresión: el webhook parcheaba reserva y folio con repos crudos, así que un cobro por Stripe
// nunca llegaba a `payments` y quedaba fuera de la conciliación bancaria (deuda F10).

import { describe, it, expect } from 'bun:test'
import { silentLogger } from 'arckode-framework/testing'
import { recordStripePayment, type StripePaymentPort, type RecordStripePaymentInput } from '../usecases/payment-port'

const log = silentLogger()

const input: RecordStripePaymentInput = {
  hotelId: 'h1',
  amount: 150,
  currency: 'USD',
  stripeSessionId: 'cs_test_123',
  stripePaymentId: 'pi_test_456',
  description: 'Pago Stripe · Reserva r1',
  reference: 'pi_test_456',
}

function makePort(over: Partial<StripePaymentPort> = {}): StripePaymentPort {
  return {
    findBySession: async () => null,
    recordPayment: async () => ({ id: 'pay1', status: 'completed' }),
    ...over,
  }
}

describe('recordStripePayment', () => {
  it('asienta el cobro en payments cuando no existe todavía', async () => {
    const recorded: RecordStripePaymentInput[] = []
    const port = makePort({
      recordPayment: async (i) => { recorded.push(i); return { id: 'pay1', status: 'completed' } },
    })

    const result = await recordStripePayment(port, log, input)

    expect(result.alreadyRecorded).toBe(false)
    expect(result.payment?.id).toBe('pay1')
    expect(recorded).toHaveLength(1)
    expect(recorded[0].stripeSessionId).toBe('cs_test_123')
    expect(recorded[0].amount).toBe(150)
  })

  it('no duplica el asiento si Stripe reintenta el webhook', async () => {
    let creates = 0
    const port = makePort({
      findBySession: async () => ({ id: 'pay-existente', status: 'completed' }),
      recordPayment: async () => { creates++; return { id: 'pay2', status: 'completed' } },
    })

    const result = await recordStripePayment(port, log, input)

    expect(result.alreadyRecorded).toBe(true)
    expect(result.payment?.id).toBe('pay-existente')
    expect(creates).toBe(0)
  })

  it('deduplica por hotelId + stripeSessionId', async () => {
    const asked: Array<[string, string]> = []
    const port = makePort({
      findBySession: async (hotelId, sessionId) => { asked.push([hotelId, sessionId]); return null },
    })

    await recordStripePayment(port, log, input)

    expect(asked).toEqual([['h1', 'cs_test_123']])
  })

  // No es best-effort: un cobro que no se asienta debe hacer fallar el webhook para que Stripe
  // reintente, no seguir de largo dejando plata fuera de la conciliación.
  it('propaga el error si el asiento falla', async () => {
    const port = makePort({
      recordPayment: async () => { throw new Error('payments caído') },
    })

    await expect(recordStripePayment(port, log, input)).rejects.toThrow('payments caído')
  })

  it('sin conector registrado avisa y no asienta nada, en vez de romper', async () => {
    const result = await recordStripePayment(null, log, input)

    expect(result.payment).toBeNull()
    expect(result.alreadyRecorded).toBe(false)
  })
})
