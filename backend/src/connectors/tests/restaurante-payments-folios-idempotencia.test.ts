// connectors/tests/restaurante-payments-folios-idempotencia.test.ts — idempotencia-settlement-pos.
//
// Los conectores SOLO cablean: verifica que `restaurantePaymentsConnector` arma
// `reference: 'pos:' + orderId` + `metadata.orderId` para el port `recordPayment`, y que
// `restauranteFoliosConnector` arma `reference: 'pos:' + orderId` para el `postCharge` del port
// `chargeToFolio`. La barrera atómica real vive en payments/folios (UNIQUE index parcial +
// claim-first); este test solo prueba que el conector NO pierde el dato que esa barrera necesita.

import { describe, it, expect } from 'bun:test'
import type { ConnectorContext } from 'arckode-framework'
import { restaurantePaymentsConnector } from '../restaurante-payments'
import { restauranteFoliosConnector } from '../restaurante-folios'

function makeCtx(modules: Record<string, any>) {
  return {
    resolveModule: (name: string) => {
      if (!(name in modules)) throw new Error(`módulo desconocido: ${name}`)
      return modules[name]
    },
  } as unknown as ConnectorContext
}

describe('restaurantePaymentsConnector — reference pos:orderId (idempotencia-settlement-pos)', () => {
  it('recordPayment arma reference y metadata con el orderId', async () => {
    let captured: any = null
    const ports: any = {}
    const restaurantStub = { setSettlementDeps: (p: any) => Object.assign(ports, p) }
    const paymentsStub = {
      createPayment: async (dto: any) => { captured = dto; return { id: 'pay1' } },
      refundPayment: async () => ({ id: 'ref1' }),
    }
    const ctx = makeCtx({ restaurant: restaurantStub, payments: paymentsStub })
    restaurantePaymentsConnector(ctx)

    const res = await ports.recordPayment({
      hotelId: 'h1', method: 'cash', amount: 23.6, description: 'Restaurante · comanda CMD-1', orderId: 'o1',
    })

    expect(res.paymentId).toBe('pay1')
    expect(captured.reference).toBe('pos:o1')
    expect(captured.metadata).toEqual({ source: 'restaurant', orderId: 'o1' })
  })
})

describe('restauranteFoliosConnector — reference pos:orderId (idempotencia-settlement-pos)', () => {
  it('chargeToFolio posta el cargo con reference pos:orderId', async () => {
    let captured: any = null
    const ports: any = {}
    const restaurantStub = { setSettlementDeps: (p: any) => Object.assign(ports, p) }
    const foliosStub = {
      list: async () => ({ data: [{ id: 'f1' }] }),
      open: async () => ({ id: 'f1' }),
      postCharge: async (folioId: string, dto: any) => { captured = { folioId, dto }; return {} },
    }
    const ctx = makeCtx({ restaurant: restaurantStub, folios: foliosStub })
    restauranteFoliosConnector(ctx)

    const res = await ports.chargeToFolio({
      hotelId: 'h1', reservationId: 'r1', description: 'Restaurante · comanda CMD-1', amount: 20, quantity: 1, orderId: 'o1',
    }, { id: 'u1' })

    expect(res.folioId).toBe('f1')
    expect(captured.folioId).toBe('f1')
    expect(captured.dto.reference).toBe('pos:o1')
    expect(captured.dto.source).toBe('pos')
  })
})
