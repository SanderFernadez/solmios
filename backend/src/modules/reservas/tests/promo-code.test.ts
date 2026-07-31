// reservas/tests/promo-code.test.ts — FIX 2026-07-31.
//
// Antes: el wizard de reserva manual del staff tenía un campo "Código promocional" que se
// guardaba como texto SIN validar ni aplicar ningún descuento. Este archivo cubre el puerto
// `PromoCodePort` (connectors/reservas-promocodes.ts) inyectado en createReservation.
//
// Casos:
//  (1) sin promoCodes cableado (compat callers/tests viejos) → crea igual, no valida
//  (2) dto sin promoCode → no llama al puerto, crea normal
//  (3) código inválido (reason del validador) → 409, NO crea la reserva
//  (4) código válido → crea la reserva Y llama incrementUses UNA vez
//  (5) incrementUses se llama DESPUÉS de crear (nunca si falla la creación)
import { describe, it, expect } from 'bun:test'
import { createReservation, type PromoCodePort } from '../usecases/crud'

const noopLogger = { info() {}, warn() {}, error() {}, debug() {} } as any
const noopCache = { get: async () => null, set: async () => {}, delete: async () => {}, flush: async () => {} } as any
const noopSockets = {} as any

const resRepo = (fail = false) => ({
  findMany: async () => [],
  create: async (data: any) => {
    if (fail) throw new Error('boom')
    return { id: 'r-new', ...data }
  },
}) as any

const baseDto = (over: Record<string, any> = {}) => ({
  hotelId: 'h1', roomId: 'room-1', guestId: 'g1', checkIn: '2026-07-20', checkOut: '2026-07-22',
  status: 'confirmed', totalAmount: 200, ...over,
}) as any

const user = { id: 'u1', role: 'hotel_admin', hotelId: 'h1' }

function makePromoPort(opts: { valid: boolean; reason?: string }): { port: PromoCodePort; incrementCalls: string[] } {
  const incrementCalls: string[] = []
  const port: PromoCodePort = {
    validate: async (_hotelId, code, _subtotal) => ({
      valid: opts.valid, discount: opts.valid ? 20 : 0, reason: opts.reason, code,
    }),
    incrementUses: async (hotelId, code) => { incrementCalls.push(`${hotelId}:${code}`) },
  }
  return { port, incrementCalls }
}

describe('createReservation — código promocional (FIX 2026-07-31)', () => {
  it('(1) sin promoCodes cableado → crea igual, no valida (compat)', async () => {
    const item = await createReservation(
      resRepo(), undefined, noopLogger, noopCache, noopSockets, {}, baseDto({ promoCode: 'ABC' }), user,
    )
    expect(item.id).toBe('r-new')
  })

  it('(2) dto sin promoCode → no llama al puerto, crea normal', async () => {
    const { port, incrementCalls } = makePromoPort({ valid: true })
    const item = await createReservation(
      resRepo(), undefined, noopLogger, noopCache, noopSockets, {}, baseDto(), user,
      undefined, undefined, undefined, port,
    )
    expect(item.id).toBe('r-new')
    expect(incrementCalls.length).toBe(0)
  })

  it('(3) código inválido → 409, NO crea la reserva', async () => {
    const { port } = makePromoPort({ valid: false, reason: 'expired' })
    const call = createReservation(
      resRepo(), undefined, noopLogger, noopCache, noopSockets, {}, baseDto({ promoCode: 'VENCIDO' }), user,
      undefined, undefined, undefined, port,
    )
    await expect(call).rejects.toThrow(/inválido/i)
  })

  it('(4) código válido → crea la reserva Y llama incrementUses una vez', async () => {
    const { port, incrementCalls } = makePromoPort({ valid: true })
    const item = await createReservation(
      resRepo(), undefined, noopLogger, noopCache, noopSockets, {}, baseDto({ promoCode: 'BIENVENIDA10' }), user,
      undefined, undefined, undefined, port,
    )
    expect(item.id).toBe('r-new')
    expect(incrementCalls).toEqual(['h1:BIENVENIDA10'])
  })

  it('(5) si la creación falla, NO se incrementa uses', async () => {
    const { port, incrementCalls } = makePromoPort({ valid: true })
    const call = createReservation(
      resRepo(true), undefined, noopLogger, noopCache, noopSockets, {}, baseDto({ promoCode: 'X' }), user,
      undefined, undefined, undefined, port,
    )
    await expect(call).rejects.toThrow('boom')
    expect(incrementCalls.length).toBe(0)
  })
})
