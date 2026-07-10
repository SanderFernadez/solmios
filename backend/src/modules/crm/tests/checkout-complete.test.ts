// crm/tests/checkout-complete.test.ts — Acreditación de una estadía al hacer checkout.
//
// Al `checked_out` se llega por dos eventos distintos (`onReservationCheckedOut` desde el botón de
// checkout, `onReservasUpdated` desde el PUT genérico). Sin dedup, una estadía acreditaría dos veces.
// Además, el check-in ya no incrementa `totalStays`: la estadía se cuenta acá, junto a `totalSpent`.

import { describe, it, expect } from 'bun:test'
import { CrmService } from '../service'

const noopLogger = { info() {}, warn() {}, error() {}, debug() {} } as any
const noopCache = { get: async () => null, set: async () => {}, delete: async () => {} } as any

function build(guest: Record<string, any>, txnsIniciales: any[] = []) {
  const txns: any[] = [...txnsIniciales]
  const guests: Record<string, any> = { [guest.id]: { ...guest } }

  const loyaltyRepo = {
    create: async (row: any) => { txns.push(row); return row },
    findMany: async (f: Record<string, any>) =>
      txns.filter((t) => Object.entries(f).every(([k, v]) => t[k] === v)),
  } as any
  const guestRepo = {
    findById: async (id: string) => guests[id] ?? null,
    update: async (id: string, patch: any) => { guests[id] = { ...guests[id], ...patch }; return guests[id] },
    findMany: async () => Object.values(guests),
  } as any
  const vacio = { findById: async () => null, findMany: async () => [], create: async (r: any) => r, update: async () => null } as any

  const service = new CrmService(loyaltyRepo, vacio, vacio, guestRepo, vacio, noopLogger, noopCache)
  return { service, guests, txns }
}

const HOTEL = 'hotel-a'
const reserva = { id: 'res-1', hotelId: HOTEL, guestId: 'g1', totalAmount: 396 }

describe('onCheckoutComplete', () => {
  it('suma la estadía, el gasto, los puntos y sube el nivel', async () => {
    const { service, guests, txns } = build({ id: 'g1', hotelId: HOTEL, totalStays: 4, totalSpent: 1240, loyaltyPoints: 60, tier: 'silver' })
    await service.onCheckoutComplete(reserva)

    expect(guests.g1.totalStays).toBe(5)
    expect(guests.g1.totalSpent).toBe(1636)
    expect(guests.g1.loyaltyPoints).toBe(4020) // 60 + 396 × 10
    expect(guests.g1.tier).toBe('gold')        // 5 estadías
    expect(txns).toHaveLength(1)
  })

  // El bug: dos eventos hacia el mismo checkout duplicaban puntos y estadías.
  it('es idempotente: la misma reserva no se acredita dos veces', async () => {
    const { service, guests, txns } = build({ id: 'g1', hotelId: HOTEL, totalStays: 4, totalSpent: 1240, loyaltyPoints: 60, tier: 'silver' })
    await service.onCheckoutComplete(reserva)
    await service.onCheckoutComplete(reserva)

    expect(guests.g1.totalStays).toBe(5)
    expect(guests.g1.loyaltyPoints).toBe(4020)
    expect(txns).toHaveLength(1)
  })

  it('una estadía de cortesía no da puntos, pero cuenta para el nivel', async () => {
    const { service, guests, txns } = build({ id: 'g1', hotelId: HOTEL, totalStays: 1, totalSpent: 0, loyaltyPoints: 0, tier: 'bronze' })
    await service.onCheckoutComplete({ ...reserva, totalAmount: 0 })

    expect(guests.g1.totalStays).toBe(2)
    expect(guests.g1.loyaltyPoints ?? 0).toBe(0)
    expect(guests.g1.tier).toBe('silver') // 2 estadías
    expect(txns).toHaveLength(0)
  })

  it('un checkout sin huésped no rompe', async () => {
    const { service, txns } = build({ id: 'g1', hotelId: HOTEL, totalStays: 0, totalSpent: 0 })
    await service.onCheckoutComplete({ ...reserva, guestId: 'fantasma' })
    expect(txns).toHaveLength(0)
  })
})
