// connectors/tests/reservas-marketing.test.ts — DT-18: on_reservation + post_checkout en tiempo
// real. Antes de este connector, NINGÚN código disparaba estos 2 triggerEvent (existían en el
// enum del schema pero jamás se enviaba nada).
import { describe, it, expect } from 'bun:test'
import type { ConnectorContext } from 'arckode-framework'
import { reservasMarketingConnector } from '../reservas-marketing'

function makeCtx(modules: Record<string, any>) {
  const captured: any = { sockets: {} }
  const reservasStub = { setSockets: (s: any) => Object.assign(captured.sockets, s) }
  const ctx = {
    resolveModule: (name: string) => {
      if (name === 'reservas') return reservasStub
      if (name in modules) return modules[name]
      throw new Error(`módulo desconocido: ${name}`)
    },
  } as unknown as ConnectorContext
  return { ctx, captured }
}

describe('reservasMarketingConnector (DT-18)', () => {
  it('reserva confirmada dispara on_reservation', async () => {
    const calls: any[] = []
    const { ctx, captured } = makeCtx({ marketing: { triggerAutoMessages: async (p: any) => { calls.push(p) } } })
    reservasMarketingConnector(ctx)

    await captured.sockets.onReservasCreated({
      id: 'r1', hotelId: 'h1', guestId: 'g1', roomId: 'rm1', status: 'confirmed',
      checkIn: '2026-08-01', checkOut: '2026-08-05',
    })

    expect(calls).toHaveLength(1)
    expect(calls[0]).toMatchObject({ hotelId: 'h1', event: 'on_reservation', reservationId: 'r1', guestId: 'g1' })
  })

  it('una reserva NO confirmada (draft/pending) no dispara on_reservation', async () => {
    const calls: any[] = []
    const { ctx, captured } = makeCtx({ marketing: { triggerAutoMessages: async (p: any) => { calls.push(p) } } })
    reservasMarketingConnector(ctx)

    await captured.sockets.onReservasCreated({ id: 'r1', hotelId: 'h1', status: 'pending' })

    expect(calls).toHaveLength(0)
  })

  it('checkout dispara post_checkout', async () => {
    const calls: any[] = []
    const { ctx, captured } = makeCtx({ marketing: { triggerAutoMessages: async (p: any) => { calls.push(p) } } })
    reservasMarketingConnector(ctx)

    await captured.sockets.onReservationCheckedOut({ reservationId: 'r2', hotelId: 'h1', guestId: 'g2', roomId: 'rm2' })

    expect(calls).toHaveLength(1)
    expect(calls[0]).toMatchObject({ hotelId: 'h1', event: 'post_checkout', reservationId: 'r2', guestId: 'g2' })
  })

  it('best-effort: si marketing falla, no propaga el error', async () => {
    const { ctx, captured } = makeCtx({ marketing: { triggerAutoMessages: async () => { throw new Error('boom') } } })
    reservasMarketingConnector(ctx)

    await expect(captured.sockets.onReservasCreated({ id: 'r1', hotelId: 'h1', status: 'confirmed' })).resolves.toBeUndefined()
  })
})
