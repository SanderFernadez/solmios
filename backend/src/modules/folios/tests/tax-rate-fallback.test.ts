// Copia hermana de facturas/tests/tax-rate-fallback.test.ts, para la implementación duplicada de
// taxRateFor en folio-math.ts. Antes de este fix el balance del folio arrancaba SIN impuesto ya
// en el primer cargo (el auto-post al check-in), no solo la factura final.
import { describe, it, expect } from 'bun:test'
import { taxRateFor } from '../usecases/folio-math'
import type { RepositoryAdapter } from 'arckode-framework'

function fakeRepo(rows: any[]): RepositoryAdapter<any> {
  return {
    findOne: async (filter: any) => rows.find((r) =>
      Object.entries(filter).every(([k, v]) => r[k] === v)) ?? null,
    findById: async (id: string) => rows.find((r) => r.id === id) ?? null,
  } as unknown as RepositoryAdapter<any>
}

describe('folio-math.taxRateFor — fallback a hotels.taxRate', () => {
  it('sin config, con hotelsRepo: usa hotels.taxRate', async () => {
    const rate = await taxRateFor(fakeRepo([]), 'h1', fakeRepo([{ id: 'h1', taxRate: 18 }]))
    expect(rate).toBe(18)
  })

  it('con config explícita: la config gana', async () => {
    const configRepo = fakeRepo([{ hotelId: 'h1', key: 'taxes', value: [{ tasa: 12, activo: true }] }])
    const rate = await taxRateFor(configRepo, 'h1', fakeRepo([{ id: 'h1', taxRate: 18 }]))
    expect(rate).toBe(12)
  })

  it('sin config y sin hotelsRepo: 0%, compatible con callers viejos', async () => {
    expect(await taxRateFor(fakeRepo([]), 'h1')).toBe(0)
  })
})
