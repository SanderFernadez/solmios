// payments/tests/refund-after-webhook.test.ts — fix-refund-pos-card.
//
// Encadena settle-webhook.ts (puebla stripePaymentId al confirmar) → refund.ts (el guard de
// 7e9e37f exige stripePaymentId no vacío). Antes de este change, un cobro POS con tarjeta quedaba
// con stripePaymentId='' PARA SIEMPRE (recordPayment nunca lo llenaba) y el refund tiraba 409 (ver
// refund.test.ts, "rechaza con ConflictError un cobro card SIN stripePaymentId"). Este test prueba
// que el flujo completo (Checkout Session → webhook completed → stripePaymentId poblado) hace que
// el MISMO guard deje de dispararse — no relaja el guard, lo esquiva con el dato que faltaba.

import { describe, it, expect } from 'bun:test'
import { settleStripeWebhook } from '../usecases/settle-webhook'
import { refundPayment } from '../usecases/refund'
import type { PaymentDTO, CreatePaymentDTO } from '../types'

describe('payments — refund tras webhook completado (fix-refund-pos-card)', () => {
  it('el webhook puebla stripePaymentId y el refund YA NO tira el 409 del guard refund-orden-pos', async () => {
    const store: Record<string, any> = {
      pay_1: { id: 'pay_1', hotelId: 'h1', status: 'processing', method: 'card', amount: 100, currency: 'USD', folioId: null, guestId: null, stripePaymentId: '' },
    }
    const crud: any = {
      updateStatus: async (id: string, status: string, stripePaymentId?: string) => {
        store[id] = { ...store[id], status, ...(stripePaymentId ? { stripePaymentId } : {}) }
        return store[id]
      },
      getById: async (id: string) => store[id],
    }
    const events: any = {
      settleOnce: async (_h: string, _p: string, _e: string, _m: unknown, effect: () => Promise<void>) => {
        await effect()
        return { outcome: 'processed' }
      },
    }
    const stripeMock: any = {
      handleWebhook: async () => ({
        status: 'paid', reference: 'pay_1', eventId: 'evt_1',
        providerRef: 'pi_abc123', amountMinor: 10000, currency: 'usd',
      }),
      isConfigured: async () => true,
      refund: async () => ({ id: 're_1', status: 'succeeded' }),
    }

    // 1) El webhook confirma el cobro: stripePaymentId pasa de '' a 'pi_abc123'.
    const outcome = await settleStripeWebhook(
      { stripe: stripeMock, crud, events, audit: async () => {} },
      'h1', Buffer.from('{}'), 'sig',
    )
    expect(outcome?.type).toBe('payment_completed')
    expect(store.pay_1.status).toBe('completed')
    expect(store.pay_1.stripePaymentId).toBe('pi_abc123')

    // 2) El refund YA NO topa con el guard — stripePaymentId no está vacío.
    let refundCreatePayload: CreatePaymentDTO | null = null
    const refundDeps = {
      crud, stripe: stripeMock,
      createPayment: async (dto: CreatePaymentDTO) => { refundCreatePayload = dto; return { id: 'pay_refund_1', ...dto } as PaymentDTO },
    }
    await expect(
      refundPayment(refundDeps as any, 'pay_1', undefined, { id: 'u1', role: 'hotel_admin' }),
    ).resolves.toBeTruthy()

    expect(refundCreatePayload).not.toBeNull()
    expect((refundCreatePayload as any).type).toBe('refund')
    expect(store.pay_1.status).toBe('refunded')
  })
})
