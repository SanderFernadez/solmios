// restaurant/tests/food-cost.test.ts — Food cost visible (F3, carta-experiencia-avanzada).
// Cubre los scenarios de specs/menu-food-cost/spec.md: costo de receta de un ítem simple, margen (incluido
// negativo, sin truncar), food cost de un combo (completo e incompleto), reporte ordenado por menor margen,
// y degradación graceful cuando inventario no está montado (nunca 500).
import { describe, it, expect } from 'bun:test'
import type { RepositoryAdapter } from 'arckode-framework'
import { itemFoodCost, comboFoodCost, foodCostReport, type FoodCostDeps } from '../usecases/food-cost'
import type { MenuItemDTO, ComboDTO, ComboItemDTO, CurrentUser } from '../types'

const user: CurrentUser = { id: 'u1', hotelId: 'h1', role: 'hotel_admin' }

function makeRepo<T extends object>(overrides: Partial<RepositoryAdapter<T>> = {}): RepositoryAdapter<T> {
  return {
    findMany: async () => [], findById: async () => null, findOne: async () => null,
    create: async (data: any) => ({ id: 'gen-id', ...data }),
    update: async (id: any, data: any) => ({ id, ...data }),
    delete: async () => true, count: async () => 0,
    paginate: async () => ({ data: [], total: 0, limit: 100, offset: 0, pages: 0 }),
    ...overrides,
  } as RepositoryAdapter<T>
}
function backed<T extends object>(store: any[], seed: any[] = []): RepositoryAdapter<T> {
  store.push(...seed)
  const match = (r: any, q: any) => Object.keys(q || {}).every((k) => r[k] === q[k])
  let n = 0
  return {
    ...makeRepo<any>(),
    create: async (d: any) => { const row = { id: `gen${++n}`, ...d }; store.push(row); return row },
    findById: async (id: any) => store.find((r) => r.id === id) ?? null,
    findOne: async (q: any) => store.find((r) => match(r, q)) ?? null,
    findMany: async (q: any = {}) => store.filter((r) => match(r, q)),
    update: async (id: any, d: any) => { const r = store.find((x) => x.id === id); if (r) Object.assign(r, d); return r ?? null },
    delete: async (id: any) => { const i = store.findIndex((x) => x.id === id); if (i >= 0) { store.splice(i, 1); return true } return false },
  } as RepositoryAdapter<T>
}

// Costos de receta pre-computados por menuItemId, simulando el puerto `recipePorts.getRecipeCost`
// (la aritmética Σ quantity×avgCost se prueba en inventario/tests, no acá — acá se prueba SOLO la
// composición margen/combo que vive en restaurant).
function portFrom(costs: Record<string, { cost: number; hasRecipe: boolean }>) {
  return async (menuItemId: string) => costs[menuItemId] ?? { cost: 0, hasRecipe: false }
}

function makeDeps(opts: {
  itemsSeed?: any[]
  combosSeed?: any[]
  comboItemsSeed?: any[]
  costs?: Record<string, { cost: number; hasRecipe: boolean }>
  mounted?: boolean
} = {}): FoodCostDeps {
  const mounted = opts.mounted ?? true
  return {
    items: backed<MenuItemDTO>([], opts.itemsSeed ?? []),
    combos: backed<ComboDTO>([], opts.combosSeed ?? []),
    comboItems: backed<ComboItemDTO>([], opts.comboItemsSeed ?? []),
    recipePorts: mounted ? { getRecipeCost: portFrom(opts.costs ?? {}) } : {},
  }
}

describe('itemFoodCost (F3)', () => {
  it('plato rentable: price=250, costo de receta=55 → margin=195, marginPercent=78', async () => {
    const deps = makeDeps({
      itemsSeed: [{ id: 'burger', hotelId: 'h1', name: 'Hamburguesa', price: 250 }],
      costs: { burger: { cost: 55, hasRecipe: true } },
    })
    const res = await itemFoodCost(deps, 'burger', user)
    expect(res.cost).toBe(55)
    expect(res.margin).toBe(195)
    expect(res.marginPercent).toBe(78)
    expect(res.hasRecipe).toBe(true)
    expect(res.available).toBe(true)
  })

  it('ítem sin receta: hasRecipe:false, EXCLUIDO del cálculo de margen (no "0%" falso)', async () => {
    const deps = makeDeps({
      itemsSeed: [{ id: 'soda', hotelId: 'h1', name: 'Refresco', price: 50 }],
      costs: {}, // sin entrada → costOf devuelve hasRecipe:false
    })
    const res = await itemFoodCost(deps, 'soda', user)
    expect(res.hasRecipe).toBe(false)
    expect(res.cost).toBe(0)
    expect(res.margin).toBeNull()
    expect(res.marginPercent).toBeNull()
  })

  it('margen negativo: price=100, costo=130 → margin=-30, marginPercent=-30 (NO trunca a 0)', async () => {
    const deps = makeDeps({
      itemsSeed: [{ id: 'losing', hotelId: 'h1', name: 'Combo perdedor', price: 100 }],
      costs: { losing: { cost: 130, hasRecipe: true } },
    })
    const res = await itemFoodCost(deps, 'losing', user)
    expect(res.margin).toBe(-30)
    expect(res.marginPercent).toBe(-30)
  })

  it('inventario no montado: { cost: null, available: false }, sin lanzar', async () => {
    const deps = makeDeps({
      itemsSeed: [{ id: 'burger', hotelId: 'h1', name: 'Hamburguesa', price: 250 }],
      mounted: false,
    })
    const res = await itemFoodCost(deps, 'burger', user)
    expect(res.cost).toBeNull()
    expect(res.available).toBe(false)
    expect(res.margin).toBeNull()
  })
})

describe('comboFoodCost (F3)', () => {
  it('combo con 3 componentes, todos costeados: comboCost=150, margin=650, marginPercent=81.25', async () => {
    const deps = makeDeps({
      combosSeed: [{ id: 'combo1', hotelId: 'h1', name: 'Combo Familiar', price: 800 }],
      comboItemsSeed: [
        { id: 'ci1', hotelId: 'h1', comboId: 'combo1', menuItemId: 'A', quantity: 2 },
        { id: 'ci2', hotelId: 'h1', comboId: 'combo1', menuItemId: 'B', quantity: 1 },
        { id: 'ci3', hotelId: 'h1', comboId: 'combo1', menuItemId: 'C', quantity: 2 },
      ],
      costs: {
        A: { cost: 55, hasRecipe: true },
        B: { cost: 20, hasRecipe: true },
        C: { cost: 10, hasRecipe: true },
      },
    })
    const res = await comboFoodCost(deps, 'combo1', user)
    expect(res.cost).toBe(150)
    expect(res.margin).toBe(650)
    expect(res.marginPercent).toBe(81.25)
    expect(res.complete).toBe(true)
  })

  it('combo con 1 componente sin receta: complete:false, el componente aporta 0 (no rompe, no inventa costo)', async () => {
    const deps = makeDeps({
      combosSeed: [{ id: 'combo1', hotelId: 'h1', name: 'Combo Familiar', price: 800 }],
      comboItemsSeed: [
        { id: 'ci1', hotelId: 'h1', comboId: 'combo1', menuItemId: 'A', quantity: 2 },
        { id: 'ci2', hotelId: 'h1', comboId: 'combo1', menuItemId: 'B', quantity: 1 },
        { id: 'ci3', hotelId: 'h1', comboId: 'combo1', menuItemId: 'C', quantity: 2 }, // Refresco: sin receta
      ],
      costs: {
        A: { cost: 55, hasRecipe: true },
        B: { cost: 20, hasRecipe: true },
        // C ausente → sin receta
      },
    })
    const res = await comboFoodCost(deps, 'combo1', user)
    expect(res.complete).toBe(false)
    expect(res.cost).toBe(2 * 55 + 1 * 20) // C aporta 0
  })

  it('inventario no montado: { cost: null, available: false }, sin lanzar', async () => {
    const deps = makeDeps({
      combosSeed: [{ id: 'combo1', hotelId: 'h1', name: 'Combo Familiar', price: 800 }],
      mounted: false,
    })
    const res = await comboFoodCost(deps, 'combo1', user)
    expect(res.cost).toBeNull()
    expect(res.available).toBe(false)
  })
})

describe('foodCostReport (F3)', () => {
  it('ordena por marginPercent ascendente por defecto', async () => {
    const deps = makeDeps({
      itemsSeed: [
        { id: 'a', hotelId: 'h1', name: 'Plato A', price: 250 }, // margin 78%
        { id: 'b', hotelId: 'h1', name: 'Plato B', price: 100 }, // margin -30%
        { id: 'c', hotelId: 'h1', name: 'Plato C', price: 200 }, // margin 45%
      ],
      costs: {
        a: { cost: 55, hasRecipe: true },
        b: { cost: 130, hasRecipe: true },
        c: { cost: 110, hasRecipe: true },
      },
    })
    const { data, total } = await foodCostReport(deps, user)
    expect(total).toBe(3)
    expect(data.map((r) => r.marginPercent)).toEqual([-30, 45, 78])
  })

  it('ítems sin receta se excluyen del reporte', async () => {
    const deps = makeDeps({
      itemsSeed: [
        { id: 'a', hotelId: 'h1', name: 'Plato A', price: 250 },
        { id: 'soda', hotelId: 'h1', name: 'Refresco', price: 50 },
      ],
      costs: { a: { cost: 55, hasRecipe: true } }, // 'soda' sin entrada → sin receta
    })
    const { data } = await foodCostReport(deps, user)
    expect(data.map((r) => r.id)).toEqual(['a'])
  })
})
