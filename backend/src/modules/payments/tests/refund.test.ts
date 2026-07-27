// payments/tests/refund.test.ts — Devolución de un cobro con tarjeta.
import { describe, it, expect } from 'bun:test'
import { refundPayment } from '../usecases/refund'
import type { CreatePaymentDTO, PaymentDTO } from '../types'

describe('payments — refund (devolución)', () => {
  it('crea el payment de reembolso con status completed (no pending) para que cashFlow y reportes lo resten', async () => {
    // FIX refund-status-cashflow: el documento de reembolso nace `completed` porque Stripe confirma
    // la devolución de forma síncrona. Si cayera al default (`pending` por method=card) nunca llegaría
    // a `completed` — el webhook sólo actúa en `paid` — y treasury.cashFlow / reports.sumCollected
    // (ambos filtran status==='completed') no lo restarían, inflando los ingresos.
    let captured: CreatePaymentDTO | null = null
    const deps = {
      crud: {
        getById: async () => ({
          id: 'p1', hotelId: 'h1', status: 'completed', method: 'card',
          amount: 1000, currency: 'USD', folioId: 'f1', guestId: 'g1', stripePaymentId: 'pi_1',
        }),
        updateStatus: async () => ({}) as PaymentDTO,
      } as any,
      stripe: {
        isConfigured: async () => true,
        refund: async () => ({ id: 're_1' }) as any,
      } as any,
      createPayment: async (dto: CreatePaymentDTO) => { captured = dto; return { id: 'p2', ...dto } as PaymentDTO },
    }

    await refundPayment(deps as any, 'p1', 1000, { id: 'u1', role: 'hotel_admin' })

    expect(captured).not.toBeNull()
    expect((captured as any).type).toBe('refund')
    expect((captured as any).status).toBe('completed')
  })

  it('rechaza con ConflictError un cobro card SIN stripePaymentId (deuda refund-orden-pos)', async () => {
    // Los cobros POS con tarjeta se registran manuales (sin cargo Stripe). Sin este guard, stripe.refund
    // recibe payment_intent='' y Stripe tira error críptico. El guard devuelve 409 claro con workaround.
    let stripeCalled = false
    const deps = {
      crud: {
        getById: async () => ({
          id: 'p1', hotelId: 'h1', status: 'completed', method: 'card',
          amount: 1000, currency: 'USD', folioId: null, guestId: null, stripePaymentId: '',
        }),
        updateStatus: async () => ({}) as PaymentDTO,
      } as any,
      stripe: {
        isConfigured: async () => true,
        refund: async () => { stripeCalled = true; return { id: 're_1' } as any },
      } as any,
      createPayment: async () => { throw new Error('NO debió crear payment') },
    }

    await expect(refundPayment(deps as any, 'p1', undefined, { id: 'u1', role: 'hotel_admin' }))
      .rejects.toThrow(/sin un cargo de Stripe asociado|fix-refund-pos-card/)
    expect(stripeCalled).toBe(false)
  })
})
