// Tests de sendPaymentLinkEmail — envía el link de pago por correo cuando el request lo pide.
import { describe, it, expect, mock } from 'bun:test'
import { silentLogger } from 'arckode-framework/testing'
import { sendPaymentLinkEmail } from '../usecases/payment-link-email'

const log = silentLogger()
function deps(enqueue: any) {
  return {
    emailSender: { enqueueNotification: enqueue } as any,
    hotelRepo: { findById: async () => ({ id: 'h1', name: 'Palma' }) } as any,
    reservationRepo: { findById: async () => ({ id: 'r1', guestId: 'g1' }) } as any,
    guestRepo: { findById: async () => ({ id: 'g1', nationality: 'Argentina' }) } as any,
    logger: log,
  }
}
const pr = (over: any = {}) => ({ id: 'pr1', hotelId: 'h1', reservationId: 'r1', amount: 150, currency: 'USD', sentTo: 'a@b.com', sentVia: 'email', ...over } as any)

describe('sendPaymentLinkEmail', () => {
  it('encola el link con event=payment_link y las variables correctas', async () => {
    const enqueue = mock(async () => 'q-1')
    await sendPaymentLinkEmail(deps(enqueue), pr(), 'https://pay.stripe.com/xyz')
    expect(enqueue).toHaveBeenCalledTimes(1)
    const input = (enqueue.mock.calls as any[][])[0][0]
    expect(input.event).toBe('payment_link')
    expect(input.to).toBe('a@b.com')
    expect(input.variables.payment_url).toBe('https://pay.stripe.com/xyz')
    expect(input.variables.amount).toBe(150)
    expect(input.variables.hotel_name).toBe('Palma')
  })

  it('no envía si sentVia no es email', async () => {
    const enqueue = mock(async () => 'q-1')
    await sendPaymentLinkEmail(deps(enqueue), pr({ sentVia: 'whatsapp' }), 'https://pay.stripe.com/xyz')
    expect(enqueue).not.toHaveBeenCalled()
  })

  it('no envía si sentTo no es un email válido', async () => {
    const enqueue = mock(async () => 'q-1')
    await sendPaymentLinkEmail(deps(enqueue), pr({ sentTo: '809-555-0000' }), 'https://pay.stripe.com/xyz')
    expect(enqueue).not.toHaveBeenCalled()
  })

  it('no envía si no hay URL de pago', async () => {
    const enqueue = mock(async () => 'q-1')
    await sendPaymentLinkEmail(deps(enqueue), pr(), '')
    expect(enqueue).not.toHaveBeenCalled()
  })
})
