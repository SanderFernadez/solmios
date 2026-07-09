// shared/tests/post-booking-payment.test.ts — El cobro del widget público entra a `payments`.
//
// Regresión: el webhook del motor de reservas solo marcaba `bookings.paymentStatus = 'paid'`. La
// tarjeta del huésped se cobraba de verdad y esa plata no existía para la conciliación bancaria.

import { describe, it, expect } from 'bun:test'
import { postBookingPayment, type BookingPaymentPort } from '../usecases/post-booking-payment'
import type { PublicBookingDTO } from '../../modules/bookingengine'

const booking = (over: Partial<PublicBookingDTO> = {}): PublicBookingDTO => ({
  id: 'b1', hotelId: 'h1', roomType: 'doble', roomId: 'r1',
  guestName: 'Ana', guestEmail: 'ana@x.com', guestPhone: '',
  checkIn: '2026-08-01', checkOut: '2026-08-03', adults: 2, children: 0,
  totalAmount: 450, currency: 'usd', status: 'confirmed',
  paymentStatus: 'paid', paymentRef: 'cs_test_1',
  ...over,
} as PublicBookingDTO)

function makePort(existing: any = null) {
  const created: any[] = []
  const port: BookingPaymentPort = {
    findByStripeSession: async () => existing,
    createPayment: async (dto: any) => { created.push(dto); return { id: 'pay1', status: 'completed' } },
  }
  return { port, created }
}

describe('postBookingPayment', () => {
  it('asienta el cobro como completado, por link de pago', async () => {
    const { port, created } = makePort()

    await postBookingPayment(port, booking())

    expect(created).toHaveLength(1)
    expect(created[0]).toMatchObject({
      hotelId: 'h1', type: 'charge', method: 'link', status: 'completed',
      amount: 450, currency: 'USD', stripeSessionId: 'cs_test_1',
    })
  })

  // Stripe reintenta el webhook ante cualquier error.
  it('no duplica el asiento si el webhook se reintenta', async () => {
    const { port, created } = makePort({ id: 'pay-existente', status: 'completed' })

    const result = await postBookingPayment(port, booking())

    expect(result?.id).toBe('pay-existente')
    expect(created).toHaveLength(0)
  })

  it('deduplica por hotelId + la sesión de Stripe', async () => {
    const asked: Array<[string, string]> = []
    const { port } = makePort()
    port.findByStripeSession = async (h, s) => { asked.push([h, s]); return null }

    await postBookingPayment(port, booking())

    expect(asked).toEqual([['h1', 'cs_test_1']])
  })

  it('sin referencia de Stripe no asienta nada: no hay cobro que respaldar', async () => {
    const { port, created } = makePort()

    expect(await postBookingPayment(port, booking({ paymentRef: '' }))).toBeNull()
    expect(created).toHaveLength(0)
  })

  it('un booking de monto cero no genera asiento', async () => {
    const { port, created } = makePort()

    expect(await postBookingPayment(port, booking({ totalAmount: 0 }))).toBeNull()
    expect(created).toHaveLength(0)
  })

  // NO es best-effort: si el dinero no se asienta, el webhook debe fallar y Stripe reintentar.
  it('propaga el error si el asiento falla', async () => {
    const { port } = makePort()
    port.createPayment = async () => { throw new Error('payments caído') }

    await expect(postBookingPayment(port, booking())).rejects.toThrow('payments caído')
  })
})
