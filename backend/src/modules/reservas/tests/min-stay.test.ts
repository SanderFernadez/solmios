// reservas/tests/min-stay.test.ts — Estadía mínima por fecha al crear una reserva.
//
// La fila "Días Mínimos" del planning guarda un minStay por FECHA de entrada (tabla DateRestrictions).
// Al crear una reserva, si dura menos noches que el mínimo de su check-in, se rechaza con 409.
// Sin override (o override = 1), el mínimo es 1 noche y no estorba.

import { describe, it, expect } from 'bun:test'
import { createReservation } from '../usecases/crud'

const noopLogger = { info() {}, warn() {}, error() {}, debug() {} } as any
const noopCache = { get: async () => null, set: async () => {}, delete: async () => {}, flush: async () => {} } as any
const noopSockets = {} as any

/** repo de reservas: habitación siempre libre; create devuelve el dto con id. */
const resRepo = () => ({
  findMany: async () => [],
  create: async (data: any) => ({ id: 'r-new', ...data }),
}) as any

/** repo de DateRestrictions con un override para una fecha puntual. */
const dateRepo = (date: string, minStay: number) => ({
  findMany: async (filter: any) => (filter?.date === date ? [{ id: 'dr1', hotelId: filter.hotelId, date, minStay }] : []),
}) as any

const baseDto = (over: Record<string, any> = {}) => ({
  hotelId: 'h1', roomId: 'room-1', guestId: 'g1', checkIn: '2026-07-20', checkOut: '2026-07-22',
  status: 'confirmed', totalAmount: 200, ...over,
}) as any

const user = { id: 'u1', role: 'hotel_admin', hotelId: 'h1' }

describe('createReservation — estadía mínima por fecha', () => {
  it('rechaza si la reserva dura menos que el mínimo de su check-in', async () => {
    // Mínimo 3 noches el 2026-07-20; la reserva es de 2 noches (20→22) → 409.
    const call = createReservation(
      resRepo(), undefined, noopLogger, noopCache, noopSockets, {}, baseDto(), user, undefined, undefined, dateRepo('2026-07-20', 3),
    )
    await expect(call).rejects.toThrow(/mínima/i)
  })

  it('acepta si cumple exactamente el mínimo', async () => {
    // Mínimo 2 noches; reserva de 2 noches (20→22) → pasa.
    const item = await createReservation(
      resRepo(), undefined, noopLogger, noopCache, noopSockets, {}, baseDto(), user, undefined, undefined, dateRepo('2026-07-20', 2),
    )
    expect(item.id).toBe('r-new')
  })

  it('sin override el mínimo es 1 noche (no estorba)', async () => {
    const item = await createReservation(
      resRepo(), undefined, noopLogger, noopCache, noopSockets, {}, baseDto({ checkIn: '2026-07-20', checkOut: '2026-07-21' }), user, undefined, undefined, dateRepo('2099-01-01', 5),
    )
    expect(item.id).toBe('r-new')
  })

  it('sin dateRestrictionRepo no valida mínimo (retrocompatible)', async () => {
    const item = await createReservation(
      resRepo(), undefined, noopLogger, noopCache, noopSockets, {}, baseDto({ checkOut: '2026-07-21' }), user,
    )
    expect(item.id).toBe('r-new')
  })
})
