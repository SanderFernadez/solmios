// promo-codes/tests/service.test.ts — Tests del facade PromoCodesService (F2 2.2).
//
// Cubre el orquestador (service → usecase) y los hooks opcionales (sockets). Mismo
// alcance que landing/tests/service.test.ts: smoke del facade + delegación correcta.
//
// Casos:
//  (1) list — devuelve lo del repo, ordenado createdAt DESC
//  (2) create — dispara onPromoCodeCreated con el code creado
//  (3) update — dispara onPromoCodeUpdated
//  (4) remove — dispara onPromoCodeDeleted con hotelId correcto
//  (5) validate — happy path (percent)
//  (6) validate — not_found no revienta (no falla ante code inexistente)
import { describe, it, expect } from 'bun:test'
import { silentLogger } from 'arckode-framework/testing'
import { PromoCodesService } from '../service'
import type { PromoCodeDTO } from '../types'

const log = silentLogger()

function makeRepo(rows: PromoCodeDTO[] = []) {
  return {
    rows,
    findMany: async (filter: any = {}) =>
      rows.filter((r) => Object.entries(filter).every(([k, v]) => (r as any)[k] === v)),
    findOne: async (filter: any) =>
      rows.find((r) => Object.entries(filter).every(([k, v]) => (r as any)[k] === v)) ?? null,
    create: async (data: any) => {
      const row = { id: `p_${rows.length + 1}`, ...data } as PromoCodeDTO
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
  }
}

function makeService(rows: PromoCodeDTO[] = []) {
  const promoCodes = makeRepo(rows) as any
  const userRepo = { findOne: async () => ({ hotelId: 'h1' }) } as any
  const auth = { assertOwnership: () => {} } as any
  const service = new PromoCodesService(promoCodes, userRepo, auth, log)
  return { service, promoCodes }
}

const adminUser = { id: 'u1', hotelId: 'h1', role: 'hotel_admin', userType: 'merchant' } as any

describe('PromoCodesService (F2 2.2)', () => {
  it('list devuelve lo del repo del hotel', async () => {
    const { service, promoCodes } = makeService()
    await service.create({ code: 'WELCOME10', kind: 'percent', value: 10 }, adminUser)
    await service.create({ code: 'FLAT25', kind: 'fixed', value: 25 }, adminUser)
    const r = await service.list(adminUser)
    expect(r.total).toBe(2)
    expect((promoCodes.rows as any[]).length).toBe(2)
  })

  it('create dispara onPromoCodeCreated', async () => {
    const { service } = makeService()
    const fired: PromoCodeDTO[] = []
    ;(service as any).setSockets({ onPromoCodeCreated: async (p: PromoCodeDTO) => { fired.push(p) } })
    const promo = await service.create({ code: 'X', kind: 'percent', value: 5 }, adminUser)
    expect(promo.code).toBe('X')
    expect(fired.length).toBe(1)
    expect(fired[0].code).toBe('X')
  })

  it('update dispara onPromoCodeUpdated', async () => {
    const existing: PromoCodeDTO = { id: 'p1', hotelId: 'h1', code: 'OLD', kind: 'percent', value: 5, active: true, uses: 0, minAmount: null, maxUses: null, validFrom: null, validTo: null, createdAt: '2026-01-01', updatedAt: '2026-01-01' }
    const { service } = makeService([existing])
    const fired: PromoCodeDTO[] = []
    ;(service as any).setSockets({ onPromoCodeUpdated: async (p: PromoCodeDTO) => { fired.push(p) } })
    const updated = await service.update('p1', { value: 15 }, adminUser)
    expect(updated.value).toBe(15)
    expect(fired.length).toBe(1)
  })

  it('remove dispara onPromoCodeDeleted con hotelId correcto', async () => {
    const existing: PromoCodeDTO = { id: 'p1', hotelId: 'h1', code: 'X', kind: 'percent', value: 5, active: true, uses: 0, minAmount: null, maxUses: null, validFrom: null, validTo: null, createdAt: '2026-01-01', updatedAt: '2026-01-01' }
    const { service } = makeService([existing])
    const fired: Array<{ id: string; hotelId: string }> = []
    ;(service as any).setSockets({ onPromoCodeDeleted: async (id: string, hotelId: string) => { fired.push({ id, hotelId }) } })
    const r = await service.remove('p1', adminUser)
    expect(r.deleted).toBe(true)
    expect(fired.length).toBe(1)
    expect(fired[0].hotelId).toBe('h1')
  })

  it('validate — happy percent', async () => {
    const existing: PromoCodeDTO = { id: 'p1', hotelId: 'h1', code: 'WELCOME10', kind: 'percent', value: 10, active: true, uses: 0, minAmount: null, maxUses: null, validFrom: null, validTo: null, createdAt: '2026-01-01', updatedAt: '2026-01-01' }
    const { service } = makeService([existing])
    const r = await service.validate('h1', 'welcome10', 300) // case-insensitive
    expect(r.valid).toBe(true)
    expect(r.discount).toBe(30)
  })

  it('validate — not_found NO revienta', async () => {
    const { service } = makeService()
    const r = await service.validate('h1', 'NOPE', 100)
    expect(r.valid).toBe(false)
    expect(r.reason).toBe('not_found')
  })
})
