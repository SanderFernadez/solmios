// bookingengine/tests/public-booking-schema.test.ts — B5 fix (audit solmi-direct-booking).
//
// Cubre la validación del body del POST /api/public/booking (controller.createPublicBookingDirect):
//  - Schema `ExtendedPublicBookingSchema` ahora incluye `roomId` (required string).
//  - `validateSchema` rechaza payload malformado (adults:"abc" → 400).
//  - Acepta payload completo válido (hotelId+roomId+guestName+email+checkIn+checkOut).
//  - `upsells`/`idempotencyKey` se reincorporan al body crudo (no validados, documentado).
//
// El controller ahora aplica `validateSchema(ExtendedPublicBookingSchema, req.body)` antes de
// pasar al usecase. Antes `req.body` iba crudo → 500 o datos corruptos en tipos malformados.
import { describe, it, expect } from 'bun:test'
import { validateSchema } from 'arckode-framework'
import { ExtendedPublicBookingSchema } from '../validators/schema'

describe('B5 — ExtendedPublicBookingSchema validate (POST /api/public/booking)', () => {
  const validPayload = {
    hotelId: 'h1',
    roomId: 'r1',
    roomType: 'standard',
    guestName: 'Ana',
    guestEmail: 'ana@example.com',
    guestPhone: '+18095550000',
    checkIn: '2026-08-10',
    checkOut: '2026-08-12',
    adults: 2,
    children: 0,
  }

  it('acepta payload válido con roomId y campos escalares', () => {
    const out = validateSchema(ExtendedPublicBookingSchema, validPayload) as Record<string, unknown>
    expect(out.hotelId).toBe('h1')
    expect(out.roomId).toBe('r1')
    expect(out.adults).toBe(2)
  })

  it('B5 — rechaza adults:"abc" (tipo incorrecto) → lanza ValidationError', () => {
    const bad = { ...validPayload, adults: 'abc' }
    expect(() => validateSchema(ExtendedPublicBookingSchema, bad)).toThrow()
  })

  it('B5 — rechaza payload sin roomId (required nuevo)', () => {
    const { roomId: _drop, ...noRoom } = validPayload
    expect(() => validateSchema(ExtendedPublicBookingSchema, noRoom)).toThrow()
  })

  it('B5 — rechaza sin guestEmail (required)', () => {
    const { guestEmail: _drop, ...noEmail } = validPayload
    expect(() => validateSchema(ExtendedPublicBookingSchema, noEmail)).toThrow()
  })

  it('B5 — rechaza checkIn/checkOut faltantes', () => {
    const { checkIn: _a, checkOut: _b, ...noDates } = validPayload
    expect(() => validateSchema(ExtendedPublicBookingSchema, noDates)).toThrow()
  })

  it('B5 — successUrl/cancelUrl opcionales (vienen del widget F2)', () => {
    const out = validateSchema(ExtendedPublicBookingSchema, {
      ...validPayload,
      successUrl: 'https://hotel.example/booking/success',
      cancelUrl: 'https://hotel.example/booking/cancel',
    }) as Record<string, unknown>
    expect(out.successUrl).toContain('/booking/success')
  })
})
