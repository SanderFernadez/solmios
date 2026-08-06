// ai-recepcionista/tests/cancel-tool.test.ts
//
// La tool `cancel_reservation` del asistente cancelaba con `reservationRepo.update(id,
// {status:'cancelled'})`: sin política, sin snapshot financiero y sin emitir
// `onReservationCancelled` (el depósito retenido quedaba colgado). Ahora delega en el puerto
// que cablea `connectors/ai-recepcionista-reservas.ts` → `reservas.cancelBySystem()`.
import { describe, it, expect } from 'bun:test'
import { executeTool } from '../usecases/llm-pipeline'

const HOTEL = 'hotel-a'

function reposWith(reservation: any, port?: any, updates: any[] = []) {
  return {
    roomRepo: {} as any,
    hotelRepo: {} as any,
    reservationRepo: {
      findById: async (id: string) => (reservation && reservation.id === id ? reservation : null),
      update: async (id: string, patch: any) => { updates.push({ id, ...patch }); return patch },
    },
    cancelReservation: port,
  } as any
}

describe('ai-recepcionista — tool cancel_reservation', () => {
  it('delega en el puerto de reservas (y NO hace update directo)', async () => {
    const calls: any[] = []
    const updates: any[] = []
    const port = async (id: string, hotelId: string, reason: string) => {
      calls.push({ id, hotelId, reason })
      return { ok: true, idempotent: false, refundAmount: 50, cancellationFee: 50 }
    }
    const repos = reposWith({ id: 'r1', hotelId: HOTEL, status: 'confirmed' }, port, updates)

    const out: any = await executeTool('cancel_reservation', { reservationId: 'r1' }, HOTEL, repos)

    expect(out.cancelled).toBe(true)
    expect(out.refundAmount).toBe(50)
    expect(out.cancellationFee).toBe(50)
    expect(calls).toHaveLength(1)
    expect(calls[0]).toMatchObject({ id: 'r1', hotelId: HOTEL })
    // El update crudo desapareció: el snapshot lo escribe reservas.
    expect(updates).toHaveLength(0)
  })

  it('guard de tenant: reserva de otro hotel → no llama al puerto', async () => {
    const calls: any[] = []
    const port = async () => { calls.push(1); return { ok: true } }
    const repos = reposWith({ id: 'r1', hotelId: 'hotel-b', status: 'confirmed' }, port)

    const out: any = await executeTool('cancel_reservation', { reservationId: 'r1' }, HOTEL, repos)

    expect(out.error).toBeTruthy()
    expect(calls).toHaveLength(0)
  })

  it('si reservas rechaza (ej. check-in hecho), la tool devuelve el error y no miente', async () => {
    const port = async () => ({ ok: false, error: 'No se puede cancelar una reserva en estado "checked_in".' })
    const repos = reposWith({ id: 'r1', hotelId: HOTEL, status: 'checked_in' }, port)

    const out: any = await executeTool('cancel_reservation', { reservationId: 'r1' }, HOTEL, repos)

    expect(out.cancelled).toBeUndefined()
    expect(out.error).toContain('checked_in')
  })

  it('sin puerto cableado NO cancela a medias', async () => {
    const updates: any[] = []
    const repos = reposWith({ id: 'r1', hotelId: HOTEL, status: 'confirmed' }, undefined, updates)

    const out: any = await executeTool('cancel_reservation', { reservationId: 'r1' }, HOTEL, repos)

    expect(out.error).toBeTruthy()
    expect(updates).toHaveLength(0)
  })
})
