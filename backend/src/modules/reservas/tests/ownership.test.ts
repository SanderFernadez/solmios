// reservas/tests/ownership.test.ts — Contrato de assertOwnership.
//
// Regresión: cuatro flujos llamaban `auth.assertOwnership(entidad, { hotelId })`, pasando objetos
// donde el framework espera `(dueño: string, solicitante: string, rol?, rolAdmin?)`. La comparación
// `requestingUserId === resourceOwnerId` entre dos objetos distintos nunca da true, y el rol llegaba
// `undefined`, así que la función lanzaba Forbidden SIEMPRE. Quedaron muertos: check-in, check-out,
// desbloqueo de tarjeta de garantía, el motor de reservas público y el ABM de planes/amenities.
//
// Los tests viejos no lo agarraron porque mockeaban `auth` con un doble que aceptaba cualquier cosa.
// Acá se instancia el `Auth` REAL: si la firma vuelve a romperse, esto falla.

import { describe, it, expect } from 'bun:test'
import { Auth } from 'arckode-framework'
import { checkinValidation, checkoutValidation } from '../usecases/checkin'
import { createPublicBookingDirect } from '../../bookingengine/usecases/public-booking'

const noopLogger = { info() {}, warn() {}, error() {}, debug() {} } as any
const fakeJwt = { sign: () => '', verify: () => ({}) } as any
const realAuth = new Auth(fakeJwt, 'test-secret', noopLogger)

const HOTEL = 'hotel-a'
const OTRO_HOTEL = 'hotel-b'

const repoWith = (reserva: any) => ({ findById: async () => reserva })
const reserva = (over: Record<string, any> = {}) => ({
  id: 'r1', hotelId: HOTEL, roomId: 'room-1', status: 'confirmed', ...over,
})

describe('checkinValidation — con el Auth real', () => {
  it('deja pasar al usuario del mismo hotel', async () => {
    const out = await checkinValidation(repoWith(reserva()), 'r1', { id: 'u1', role: 'hotel_admin', hotelId: HOTEL }, realAuth)
    expect(out.reservation.id).toBe('r1')
    expect(out.hotelId).toBe(HOTEL)
  })

  it('deja pasar al super_admin de otro hotel', async () => {
    const out = await checkinValidation(repoWith(reserva()), 'r1', { id: 'u1', role: 'super_admin', hotelId: OTRO_HOTEL }, realAuth)
    expect(out.reservation.id).toBe('r1')
  })

  it('bloquea al usuario de otro hotel', async () => {
    const call = checkinValidation(repoWith(reserva()), 'r1', { id: 'u1', role: 'hotel_admin', hotelId: OTRO_HOTEL }, realAuth)
    await expect(call).rejects.toThrow()
  })

  it('sigue validando el estado (no se saltea por el assert)', async () => {
    const call = checkinValidation(repoWith(reserva({ status: 'checked_in' })), 'r1', { id: 'u1', role: 'hotel_admin', hotelId: HOTEL }, realAuth)
    await expect(call).rejects.toThrow(/ya tiene check-in/)
  })
})

describe('checkoutValidation — con el Auth real', () => {
  it('deja pasar al usuario del mismo hotel sobre una reserva con check-in', async () => {
    const out = await checkoutValidation(repoWith(reserva({ status: 'checked_in' })), 'r1', { id: 'u1', role: 'receptionist', hotelId: HOTEL }, realAuth)
    expect(out.reservation.status).toBe('checked_in')
  })

  it('bloquea al usuario de otro hotel', async () => {
    const call = checkoutValidation(repoWith(reserva({ status: 'checked_in' })), 'r1', { id: 'u1', role: 'receptionist', hotelId: OTRO_HOTEL }, realAuth)
    await expect(call).rejects.toThrow()
  })
})

describe('createPublicBookingDirect — el motor público no tiene usuario', () => {
  const body = {
    hotelId: HOTEL, roomId: 'room-1', guestName: 'Ada', guestEmail: 'ada@test.com',
    checkIn: '2030-01-10', checkOut: '2030-01-12', adults: 2,
  }
  const ormWith = (room: any) => ({
    findById: async () => room,
    findMany: async () => [],
    create: async (_t: string, row: any) => ({ id: 'new', ...row }),
    transaction: async (fn: any) => fn({ create: async (_t: string, row: any) => ({ id: 'new', ...row }), update: async () => {} }),
  })

  // El bug: acá devolvía 403 con la habitación del PROPIO hotel. Nadie podía reservar desde el sitio.
  it('acepta una reserva sobre una habitación del hotel del formulario', async () => {
    const res: any = await createPublicBookingDirect(ormWith({ id: 'room-1', hotelId: HOTEL, basePrice: 100 }), body, undefined, realAuth)
    expect(res.status).not.toBe(403)
  })

  it('rechaza una habitación que es de otro hotel', async () => {
    const call = createPublicBookingDirect(ormWith({ id: 'room-1', hotelId: OTRO_HOTEL, basePrice: 100 }), body, undefined, realAuth)
    await expect(call).rejects.toThrow()
  })
})
