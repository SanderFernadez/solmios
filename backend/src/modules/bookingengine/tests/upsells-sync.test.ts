// bookingengine/tests/upsells-sync.test.ts — FIX 2026-07-31.
//
// Cubre el connector paquetes → bookingengine (Ofertas → Upsells): antes eran catálogos sin
// relación, cargar un servicio en Ofertas no aparecía en el step de Extras del widget.
//
// Casos:
//  (1) crea un Upsell nuevo con el MISMO id que el paquete, kind='per_stay' default
//  (2) llamar de nuevo con el mismo id → UPDATE, no duplica (upsert idempotente)
//  (3) update preserva el `kind` existente (no lo pisa con 'per_stay' de nuevo)
//  (4) active: number 1/0 del paquete se normaliza a boolean
//  (5) removeSyncedUpsell borra el espejo
//  (6) removeSyncedUpsell sobre un id que nunca existió → no explota (no-op)
import { describe, it, expect } from 'bun:test'
import { syncUpsellFromPackage, removeSyncedUpsell } from '../usecases/upsells-sync'
import type { UpsellDTO } from '../types'

function makeRepo(rows: UpsellDTO[] = []) {
  return {
    findOne: async (filter: any) =>
      rows.find((r) => Object.entries(filter).every(([k, v]) => (r as any)[k] === v)) ?? null,
    create: async (data: any) => {
      const row = { ...data } as UpsellDTO
      rows.push(row)
      return row
    },
    update: async (id: string, patch: any) => {
      const idx = rows.findIndex((r) => r.id === id)
      if (idx === -1) return null
      rows[idx] = { ...rows[idx], ...patch }
      return rows[idx]
    },
    delete: async (id: string) => {
      const idx = rows.findIndex((r) => r.id === id)
      if (idx === -1) return false
      rows.splice(idx, 1)
      return true
    },
  } as any
}

describe('upsells-sync — Ofertas → Upsells (FIX 2026-07-31)', () => {
  it('(1) crea un Upsell nuevo con el mismo id del paquete, kind=per_stay default', async () => {
    const rows: UpsellDTO[] = []
    const repo = makeRepo(rows)
    await syncUpsellFromPackage({ upsells: repo }, {
      id: 'pkg1', hotelId: 'h1', name: 'Desayuno buffet', description: 'Todo incluido', price: 15,
    })
    expect(rows.length).toBe(1)
    expect(rows[0].id).toBe('pkg1')
    expect(rows[0].hotelId).toBe('h1')
    expect(rows[0].name).toBe('Desayuno buffet')
    expect(rows[0].price).toBe(15)
    expect(rows[0].kind).toBe('per_stay')
    expect(rows[0].active).toBe(true)
  })

  it('(2) segunda llamada con el mismo id → UPDATE, no duplica', async () => {
    const rows: UpsellDTO[] = []
    const repo = makeRepo(rows)
    const pkg = { id: 'pkg1', hotelId: 'h1', name: 'Desayuno', description: '', price: 10 }
    await syncUpsellFromPackage({ upsells: repo }, pkg)
    await syncUpsellFromPackage({ upsells: repo }, { ...pkg, name: 'Desayuno buffet', price: 15 })
    expect(rows.length).toBe(1)
    expect(rows[0].name).toBe('Desayuno buffet')
    expect(rows[0].price).toBe(15)
  })

  it('(3) update preserva el kind existente (no lo pisa)', async () => {
    const rows: UpsellDTO[] = [
      { id: 'pkg1', hotelId: 'h1', name: 'Desayuno', description: '', price: 10, kind: 'per_person', active: true, sortOrder: 3, createdAt: 't', updatedAt: 't' },
    ]
    const repo = makeRepo(rows)
    await syncUpsellFromPackage({ upsells: repo }, { id: 'pkg1', hotelId: 'h1', name: 'Desayuno buffet', description: '', price: 12 })
    expect(rows[0].kind).toBe('per_person') // NO se pisó con 'per_stay'
    expect(rows[0].sortOrder).toBe(3) // tampoco se toca el orden manual
    expect(rows[0].price).toBe(12)
  })

  it('(4) active numérico del paquete (1/0) se normaliza a boolean', async () => {
    const rows: UpsellDTO[] = []
    const repo = makeRepo(rows)
    await syncUpsellFromPackage({ upsells: repo }, { id: 'pkg1', hotelId: 'h1', name: 'X', price: 5, active: 0 })
    expect(rows[0].active).toBe(false)
    await syncUpsellFromPackage({ upsells: repo }, { id: 'pkg2', hotelId: 'h1', name: 'Y', price: 5, active: 1 })
    expect(rows[1].active).toBe(true)
  })

  it('(5) removeSyncedUpsell borra el espejo', async () => {
    const rows: UpsellDTO[] = [
      { id: 'pkg1', hotelId: 'h1', name: 'X', description: '', price: 5, kind: 'per_stay', active: true, sortOrder: 0, createdAt: 't', updatedAt: 't' },
    ]
    const repo = makeRepo(rows)
    await removeSyncedUpsell({ upsells: repo }, 'pkg1')
    expect(rows.length).toBe(0)
  })

  it('(6) removeSyncedUpsell sobre id inexistente no explota', async () => {
    const repo = makeRepo([])
    await expect(removeSyncedUpsell({ upsells: repo }, 'nunca-existio')).resolves.toBeUndefined()
  })
})
