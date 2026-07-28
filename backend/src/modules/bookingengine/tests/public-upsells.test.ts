// bookingengine/tests/public-upsells.test.ts — F2 2.6 (spec booking-widget).
//
// Cubre el endpoint GET /api/public/hotels/:slug/upsells a nivel usecase.
//
// Aceptancia (tasks.md 2.6):
//  - devuelve array de upsells ordenado por sortOrder.
//  - solo upsells activos (active=true).
//  - filtro opcional ?kind= per_room|per_person|per_stay.
//
// Casos:
//  (1) Happy path — 3 upsells, se ordenan por sortOrder ASC.
//  (2) active=false se excluye.
//  (3) ?kind=per_stay filtra solo ese kind.
//  (4) ?kind=foo (inválido) → array vacío (no es error del server).
//  (5) Hotel inexistente/pausado → 404.
//  (6) Hotel sin upsells → array vacío (200, no 404).
import { describe, it, expect } from 'bun:test'
import { getPublicUpsells } from '../usecases/public-upsells'
import type { UpsellDTO } from '../types'

const baseUpsell = (overrides: Partial<UpsellDTO> = {}): UpsellDTO => ({
  id: 'u1', hotelId: 'h1', name: 'Desayuno', description: 'Buffet',
  price: 15, kind: 'per_person', active: true, sortOrder: 0,
  createdAt: '2026-01-01T00:00:00Z', updatedAt: '2026-01-01T00:00:00Z',
  ...overrides,
})

const makeDeps = (hotel: any, upsells: UpsellDTO[]) => ({
  hotels: { findOne: async () => hotel } as any,
  upsells: { findMany: async () => upsells } as any,
})

const activeHotel = { id: 'h1', slug: 'caribe', onlineBookingStatus: 'active' }

describe('getPublicUpsells — F2 2.6', () => {
  it('happy path: lista upsells ordenados por sortOrder ASC', async () => {
    const deps = makeDeps(activeHotel, [
      baseUpsell({ id: 'u3', name: 'Late checkout', sortOrder: 2 }),
      baseUpsell({ id: 'u1', name: 'Desayuno', sortOrder: 0 }),
      baseUpsell({ id: 'u2', name: 'Transfer', sortOrder: 1 }),
    ])
    const res = await getPublicUpsells(deps as any, 'caribe')
    expect(res.status).toBe(200)
    expect(res.body.map((u: any) => u.id)).toEqual(['u1', 'u2', 'u3'])
    // Shape: solo id, name, description, price, kind (sortOrder para debug).
    expect(res.body[0]).toMatchObject({
      id: 'u1', name: 'Desayuno', description: 'Buffet', price: 15, kind: 'per_person',
    })
  })

  it('active=false se excluye', async () => {
    const deps = makeDeps(activeHotel, [
      baseUpsell({ id: 'u1', active: true }),
      baseUpsell({ id: 'u2', active: false, name: 'Inactive' }),
      baseUpsell({ id: 'u3', active: true, name: 'Other' }),
    ])
    const res = await getPublicUpsells(deps as any, 'caribe')
    expect(res.body.map((u: any) => u.id)).toEqual(['u1', 'u3'])
  })

  it('?kind=per_stay filtra solo ese kind', async () => {
    const deps = makeDeps(activeHotel, [
      baseUpsell({ id: 'u1', kind: 'per_person', name: 'Desayuno' }),
      baseUpsell({ id: 'u2', kind: 'per_stay', name: 'Late checkout' }),
      baseUpsell({ id: 'u3', kind: 'per_stay', name: 'Transfer' }),
    ])
    const res = await getPublicUpsells(deps as any, 'caribe', 'per_stay')
    expect(res.body.map((u: any) => u.id)).toEqual(['u2', 'u3'])
  })

  it('?kind=foo (inválido) → array vacío, NO 400', async () => {
    const deps = makeDeps(activeHotel, [
      baseUpsell({ id: 'u1', kind: 'per_person' }),
    ])
    const res = await getPublicUpsells(deps as any, 'caribe', 'foo')
    expect(res.status).toBe(200)
    expect(res.body).toEqual([])
  })

  it('hotel inexistente → 404', async () => {
    const deps = makeDeps(null, [])
    const res = await getPublicUpsells(deps as any, 'no-existe')
    expect(res.status).toBe(404)
  })

  it('hotel pausado → MISMO 404', async () => {
    const deps = makeDeps({ ...activeHotel, onlineBookingStatus: 'paused' }, [
      baseUpsell({ id: 'u1' }),
    ])
    const res = await getPublicUpsells(deps as any, 'caribe')
    expect(res.status).toBe(404)
  })

  it('hotel sin upsells → array vacío (200)', async () => {
    const deps = makeDeps(activeHotel, [])
    const res = await getPublicUpsells(deps as any, 'caribe')
    expect(res.status).toBe(200)
    expect(res.body).toEqual([])
  })

  it('desempate por createdAt cuando sortOrder es igual', async () => {
    const deps = makeDeps(activeHotel, [
      baseUpsell({ id: 'u2', sortOrder: 5, createdAt: '2026-01-02T00:00:00Z' }),
      baseUpsell({ id: 'u1', sortOrder: 5, createdAt: '2026-01-01T00:00:00Z' }),
    ])
    const res = await getPublicUpsells(deps as any, 'caribe')
    expect(res.body.map((u: any) => u.id)).toEqual(['u1', 'u2'])
  })
})
