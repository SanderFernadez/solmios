// Bug encontrado facturando de punta a punta en un hotel recién registrado: la factura salía en
// $80 en vez de $88 (10%), aunque el wizard de reservas SÍ mostraba el impuesto. Causa: ninguna
// pantalla del producto escribe nunca en `configuration(key='taxes')`, que es la ÚNICA fuente que
// leía `taxRateFor` — así que TODA factura de TODO hotel salía con 0% de impuesto, sin importar
// lo que el dueño cargara en Configuración → Impuestos (que escribe `hotels.taxRate`, un campo
// que nada leía). `taxRateFor` ahora cae a `hotels.taxRate` cuando la config está vacía.
import { describe, it, expect } from 'bun:test'
import { taxRateFor } from '../usecases/billing'
import type { RepositoryAdapter } from 'arckode-framework'

function fakeRepo(rows: any[]): RepositoryAdapter<any> {
  return {
    findOne: async (filter: any) => rows.find((r) =>
      Object.entries(filter).every(([k, v]) => r[k] === v)) ?? null,
    findById: async (id: string) => rows.find((r) => r.id === id) ?? null,
  } as unknown as RepositoryAdapter<any>
}

describe('taxRateFor — fallback a hotels.taxRate', () => {
  it('sin config y sin hotelsRepo: 0% (comportamiento histórico, no rompe callers viejos)', async () => {
    const rate = await taxRateFor(fakeRepo([]), 'h1')
    expect(rate).toBe(0)
  })

  it('sin config de impuestos, CON hotelsRepo: usa hotels.taxRate — el bug real', async () => {
    const configRepo = fakeRepo([])
    const hotelsRepo = fakeRepo([{ id: 'h1', taxRate: 18 }])
    const rate = await taxRateFor(configRepo, 'h1', hotelsRepo)
    expect(rate).toBe(18)
  })

  it('con config explícita de impuestos: la config gana sobre hotels.taxRate', async () => {
    const configRepo = fakeRepo([
      { hotelId: 'h1', key: 'taxes', value: [{ tasa: 12, activo: true }] },
    ])
    const hotelsRepo = fakeRepo([{ id: 'h1', taxRate: 18 }])
    const rate = await taxRateFor(configRepo, 'h1', hotelsRepo)
    expect(rate).toBe(12)
  })

  it('suma varias tasas activas y descarta las inactivas', async () => {
    const configRepo = fakeRepo([
      { hotelId: 'h1', key: 'taxes', value: [{ tasa: 10, activo: true }, { tasa: 5, activo: true }, { tasa: 3, activo: false }] },
    ])
    const rate = await taxRateFor(configRepo, 'h1')
    expect(rate).toBe(15)
  })

  it('hotel sin taxRate configurado (ni config ni hotels): 0%, no NaN', async () => {
    const configRepo = fakeRepo([])
    const hotelsRepo = fakeRepo([{ id: 'h1' }])
    const rate = await taxRateFor(configRepo, 'h1', hotelsRepo)
    expect(rate).toBe(0)
  })

  it('hotelId inexistente en hotelsRepo: 0%, no explota', async () => {
    const rate = await taxRateFor(fakeRepo([]), 'no-existe', fakeRepo([]))
    expect(rate).toBe(0)
  })
})
