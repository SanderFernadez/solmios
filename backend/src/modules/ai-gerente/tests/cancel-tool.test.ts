// ai-gerente/tests/cancel-tool.test.ts
//
// La tool `cancel_reservation` del Gerente IA cancelaba con `reservationRepo.update(id,
// {status:'cancelled'})`: sin política, sin snapshot financiero y sin emitir
// `onReservationCancelled` (el depósito retenido quedaba colgado). Ahora delega en el puerto
// que cablea `connectors/ai-gerente-reservas.ts` → `reservas.cancelBySystem()`.
import { describe, it, expect } from 'bun:test'
import { executeManagerTool } from '../usecases/tools'

const HOTEL = 'hotel-a'

function reposWith(reservation: any, port?: any, updates: any[] = []) {
  return {
    roomRepo: {} as any,
    hotelRepo: {} as any,
    guestRepo: { findById: async () => ({ name: 'Ana' }) },
    reservationRepo: {
      findById: async (id: string) => (reservation && reservation.id === id ? reservation : null),
      update: async (id: string, patch: any) => { updates.push({ id, ...patch }); return patch },
    },
    cancelReservation: port,
  } as any
}

describe('ai-gerente — tool cancel_reservation', () => {
  it('sin confirmed:true pide confirmación y no toca nada', async () => {
    const calls: any[] = []
    const updates: any[] = []
    const port = async () => { calls.push(1); return { ok: true } }
    const repos = reposWith({ id: 'r1', hotelId: HOTEL, status: 'confirmed', guestId: 'g1' }, port, updates)

    const out: any = await executeManagerTool('cancel_reservation', { reservationId: 'r1' }, HOTEL, repos)

    expect(out.requiresConfirmation).toBe(true)
    expect(calls).toHaveLength(0)
    expect(updates).toHaveLength(0)
  })

  it('con confirmed:true delega en el puerto de reservas (y NO hace update directo)', async () => {
    const calls: any[] = []
    const updates: any[] = []
    const port = async (id: string, hotelId: string, reason: string) => {
      calls.push({ id, hotelId, reason })
      return { ok: true, idempotent: false, refundAmount: 0, cancellationFee: 100 }
    }
    const repos = reposWith({ id: 'r1', hotelId: HOTEL, status: 'confirmed', guestId: 'g1' }, port, updates)

    const out: any = await executeManagerTool('cancel_reservation', { reservationId: 'r1', confirmed: true }, HOTEL, repos)

    expect(out.ok).toBe(true)
    expect(out.status).toBe('cancelled')
    expect(out.cancellationFee).toBe(100)
    expect(calls).toHaveLength(1)
    expect(calls[0]).toMatchObject({ id: 'r1', hotelId: HOTEL })
    expect(updates).toHaveLength(0)
  })

  it('guard de tenant: reserva de otro hotel → no llama al puerto', async () => {
    const calls: any[] = []
    const port = async () => { calls.push(1); return { ok: true } }
    const repos = reposWith({ id: 'r1', hotelId: 'hotel-b', status: 'confirmed' }, port)

    const out: any = await executeManagerTool('cancel_reservation', { reservationId: 'r1', confirmed: true }, HOTEL, repos)

    expect(out.error).toBeTruthy()
    expect(calls).toHaveLength(0)
  })

  it('sin puerto cableado NO cancela a medias', async () => {
    const updates: any[] = []
    const repos = reposWith({ id: 'r1', hotelId: HOTEL, status: 'confirmed' }, undefined, updates)

    const out: any = await executeManagerTool('cancel_reservation', { reservationId: 'r1', confirmed: true }, HOTEL, repos)

    expect(out.error).toBeTruthy()
    expect(updates).toHaveLength(0)
  })
})
