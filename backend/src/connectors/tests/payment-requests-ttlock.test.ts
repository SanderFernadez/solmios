// connectors/tests/payment-requests-ttlock.test.ts — genera el PIN de cerradura al pagarse la seña.
//
// El connector solo DELEGA: al dispararse `onPaymentRequestPaid` (webhook de Stripe), llama a
// `ttlock.generateCodeIfAbsent(hotelId, reservationId)`. Lo crítico: un fallo de TTLock NO puede
// tumbar el webhook (si el handler tira, Stripe devuelve 500 y reintenta en loop). La idempotencia
// vive en el service (test aparte); acá se verifica el cableado y la robustez.

import { describe, it, expect } from 'bun:test'
import type { ConnectorContext } from 'arckode-framework'
import { silentLogger } from 'arckode-framework/testing'
import { paymentRequestsTtlockConnector } from '../payment-requests-ttlock'

const log = silentLogger()

/** ctx mock: captura los sockets que el connector inyecta a payment-requests y resuelve ttlock. */
function makeCtx(modules: Record<string, any> = {}) {
  const captured: { sockets: any } = { sockets: {} }
  const paymentRequests = { setSockets: (s: any) => Object.assign(captured.sockets, s) }
  const ctx = {
    resolveModule: (name: string) => {
      if (name === 'payment-requests') return paymentRequests
      if (name in modules) return modules[name]
      throw new Error(`módulo desconocido: ${name}`)
    },
  } as unknown as ConnectorContext
  return { ctx, captured }
}

describe('paymentRequestsTtlockConnector', () => {
  it('delega en generateCodeIfAbsent al pagarse la seña', async () => {
    const calls: Array<[string, string]> = []
    const { ctx, captured } = makeCtx({
      ttlock: { generateCodeIfAbsent: async (h: string, r: string) => { calls.push([h, r]); return { code: '123456' } } },
    })
    paymentRequestsTtlockConnector(log)(ctx)
    await captured.sockets.onPaymentRequestPaid({ hotelId: 'h1', reservationId: 'res1' })
    expect(calls).toEqual([['h1', 'res1']])
  })

  it('si TTLock falla (sin cerradura, hotel sin conectar), el webhook NO se rompe', async () => {
    const { ctx, captured } = makeCtx({
      ttlock: { generateCodeIfAbsent: async () => { throw new Error('La habitación no tiene cerradura TTLock') } },
    })
    paymentRequestsTtlockConnector(log)(ctx)
    await expect(captured.sockets.onPaymentRequestPaid({ hotelId: 'h1', reservationId: 'res1' })).resolves.toBeUndefined()
  })

  it('sin hotelId o reservationId no hace nada', async () => {
    let touched = 0
    const { ctx, captured } = makeCtx({
      ttlock: { generateCodeIfAbsent: async () => { touched++; return {} } },
    })
    paymentRequestsTtlockConnector(log)(ctx)
    await captured.sockets.onPaymentRequestPaid({ hotelId: 'h1' })
    await captured.sockets.onPaymentRequestPaid({ reservationId: 'res1' })
    expect(touched).toBe(0)
  })

  it('si ttlock no está registrado en el despliegue, no rompe', async () => {
    const { ctx, captured } = makeCtx({}) // sin ttlock
    paymentRequestsTtlockConnector(log)(ctx)
    await expect(captured.sockets.onPaymentRequestPaid({ hotelId: 'h1', reservationId: 'res1' })).resolves.toBeUndefined()
  })
})
