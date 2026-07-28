// restaurant/tests/allergens.test.ts — Alérgenos/info dietética de la carta (F5). Cubre TODOS los
// scenarios de specs/menu-allergens/spec.md: tags válidos persisten, tag inválido rechaza 400 sin
// actualizar el ítem, ítem con alérgenos se agrega a comanda SIN fricción, combo deriva unión de
// componentes, componente sin allergens declarado no aporta falso negativo.
import { describe, it, expect } from 'bun:test'
import type { RepositoryAdapter, Auth } from 'arckode-framework'
import * as itemsCrud from '../usecases/items-crud'
import * as combosCrud from '../usecases/combos-crud'
import { addLine, type OrderLinesDeps } from '../usecases/order-lines'
import type {
  CategoryDTO, MenuItemDTO, StationDTO, ComboDTO, ComboItemDTO, OrderDTO, OrderItemDTO, CurrentUser,
} from '../types'

const strictAuth: Auth = {
  assertOwnership: (resourceHotel: string, userHotel: string, role?: string, sa?: string) => {
    if (role === sa) return
    if (resourceHotel !== userHotel) throw new Error('IDOR: recurso de otro hotel')
  },
  authenticate: (() => []) as any,
} as unknown as Auth
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
function makeUserRepo(hotelId = 'h1'): RepositoryAdapter<any> {
  return { ...makeRepo<any>(), findById: async () => ({ id: 'u1', hotelId }) }
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

// ─── Ítems ───
function itemDeps(overrides: Partial<{ itemsStore: any[]; categoriesSeed: any[] }> = {}): itemsCrud.ItemsCrudDeps {
  return {
    items: backed<MenuItemDTO>(overrides.itemsStore ?? []),
    categories: backed<CategoryDTO>([], overrides.categoriesSeed ?? [{ id: 'cat1', hotelId: 'h1', name: 'Entradas' }]),
    stations: backed<StationDTO>([]),
    userRepo: makeUserRepo(),
    auth: strictAuth,
  }
}

describe('allergens — ítems', () => {
  it('tags válidos persisten', async () => {
    const d = itemDeps()
    const created = await itemsCrud.createItem(d, {
      categoryId: 'cat1', name: 'Curry picante', price: 100, allergens: ['spicy', 'lactose'],
    }, user)
    expect(created.allergens).toEqual(['spicy', 'lactose'])

    const fetched = await itemsCrud.getItem(d, created.id, user)
    expect(fetched.allergens).toEqual(['spicy', 'lactose'])
  })

  it('tag fuera del catálogo se rechaza en createItem (400), no crea el ítem', async () => {
    const d = itemDeps({ itemsStore: [] })
    const before = await d.items.findMany({ hotelId: 'h1' })
    await expect(itemsCrud.createItem(d, {
      categoryId: 'cat1', name: 'Curry picante', price: 100, allergens: ['gluten', 'invented_tag' as any],
    }, user)).rejects.toThrow('"invented_tag" no es un alérgeno/tag válido')
    const after = await d.items.findMany({ hotelId: 'h1' })
    expect(after.length).toBe(before.length)
  })

  it('tag fuera del catálogo se rechaza en updateItem (400), NO actualiza el ítem', async () => {
    const d = itemDeps()
    const created = await itemsCrud.createItem(d, {
      categoryId: 'cat1', name: 'Curry picante', price: 100, allergens: ['spicy'],
    }, user)
    await expect(itemsCrud.updateItem(d, created.id, { allergens: ['gluten', 'invented_tag' as any] }, user))
      .rejects.toThrow('"invented_tag" no es un alérgeno/tag válido')

    const fetched = await itemsCrud.getItem(d, created.id, user)
    expect(fetched.allergens).toEqual(['spicy'])   // sin cambios
  })

  it('updateItem con tags válidos reemplaza los allergens', async () => {
    const d = itemDeps()
    const created = await itemsCrud.createItem(d, {
      categoryId: 'cat1', name: 'Papas', price: 50, allergens: ['gluten'],
    }, user)
    const updated = await itemsCrud.updateItem(d, created.id, { allergens: ['vegan', 'vegetarian'] }, user)
    expect(updated.allergens).toEqual(['vegan', 'vegetarian'])
  })

  it('sin allergens en el body → el ítem queda sin tags declarados (compat retro)', async () => {
    const d = itemDeps()
    const created = await itemsCrud.createItem(d, { categoryId: 'cat1', name: 'Refresco', price: 30 }, user)
    expect(created.allergens).toBeUndefined()
  })
})

// ─── addLine: alérgenos nunca bloquean la venta ───
function orderLinesDeps(overrides: Partial<{ itemsSeed: any[] }> = {}): { deps: OrderLinesDeps; linesStore: any[]; ordersStore: any[] } {
  const ordersStore: any[] = [{ id: 'o1', hotelId: 'h1', status: 'open', tip: 0, subtotal: 0, tax: 0, total: 0 }]
  const linesStore: any[] = []
  const itemsSeed = overrides.itemsSeed ?? [
    { id: 'A', hotelId: 'h1', name: 'Curry picante', price: 100, categoryId: 'cat1', available: 1, allergens: ['spicy', 'nuts'] },
  ]
  const categoriesSeed = [{ id: 'cat1', hotelId: 'h1', name: 'Entradas' }]
  const items = backed<MenuItemDTO>([], itemsSeed)
  const categories = backed<CategoryDTO>([], categoriesSeed)
  const stations = backed<StationDTO>([])
  const config = makeRepo<any>({ findOne: async () => null })
  const hotels = makeRepo<any>({ findById: async () => ({ id: 'h1', taxRate: 0 }) })
  const deps: OrderLinesDeps = {
    orders: backed<OrderDTO>(ordersStore),
    lines: backed<OrderItemDTO>(linesStore),
    items, categories, stations, config, hotels,
    userRepo: makeUserRepo(), auth: strictAuth,
    combos: backed<ComboDTO>([]),
    comboItems: backed<ComboItemDTO>([]),
  }
  return { deps, linesStore, ordersStore }
}

describe('allergens — no bloquean addLine (informativos)', () => {
  it('ítem con allergens se agrega a la comanda exactamente igual, sin ValidationError', async () => {
    const { deps, linesStore } = orderLinesDeps()
    const line = await addLine(deps, 'o1', { menuItemId: 'A', quantity: 1 }, user)
    expect(line.name).toBe('Curry picante')
    expect(linesStore).toHaveLength(1)
  })
})

// ─── Combos: allergens derivado (unión de componentes) ───
function comboDeps(overrides: Partial<{ combosStore: any[]; comboItemsStore: any[]; itemsSeed: any[] }> = {}): combosCrud.CombosCrudDeps {
  return {
    combos: backed<ComboDTO>(overrides.combosStore ?? []),
    comboItems: backed<ComboItemDTO>(overrides.comboItemsStore ?? []),
    items: backed<MenuItemDTO>([], overrides.itemsSeed ?? [{ id: 'A', hotelId: 'h1', name: 'Hamburguesa' }]),
    userRepo: makeUserRepo(),
    auth: strictAuth,
  }
}

describe('allergens — combo deriva unión de componentes', () => {
  it('getCombo devuelve la unión de allergens de sus componentes', async () => {
    const d = comboDeps({
      itemsSeed: [
        { id: 'A', hotelId: 'h1', name: 'Hamburguesa', allergens: ['gluten'] },
        { id: 'B', hotelId: 'h1', name: 'Papas', allergens: ['lactose'] },
      ],
    })
    const combo = await combosCrud.createCombo(d, {
      name: 'Combo Familiar', price: 800,
      items: [{ menuItemId: 'A', quantity: 1 }, { menuItemId: 'B', quantity: 1 }],
    }, user)

    const fetched = await combosCrud.getCombo(d, combo.id, user)
    expect(new Set(fetched.allergens)).toEqual(new Set(['gluten', 'lactose']))
  })

  it('listCombos también deriva la unión', async () => {
    const d = comboDeps({
      itemsSeed: [
        { id: 'A', hotelId: 'h1', name: 'Hamburguesa', allergens: ['gluten'] },
        { id: 'B', hotelId: 'h1', name: 'Papas', allergens: ['lactose'] },
      ],
    })
    await combosCrud.createCombo(d, {
      name: 'Combo Familiar', price: 800,
      items: [{ menuItemId: 'A', quantity: 1 }, { menuItemId: 'B', quantity: 1 }],
    }, user)

    const { data } = await combosCrud.listCombos(d, user)
    expect(new Set(data[0].allergens)).toEqual(new Set(['gluten', 'lactose']))
  })

  it('cambiar un componente por uno con allergens distintos actualiza la PRÓXIMA lectura sin tocar el combo', async () => {
    const d = comboDeps({
      itemsSeed: [
        { id: 'A', hotelId: 'h1', name: 'Hamburguesa', allergens: [] },
        { id: 'B', hotelId: 'h1', name: 'Papas', allergens: [] },
        { id: 'B2', hotelId: 'h1', name: 'Papas con queso', allergens: ['lactose'] },
      ],
    })
    const combo = await combosCrud.createCombo(d, {
      name: 'Combo Familiar', price: 800,
      items: [{ menuItemId: 'A', quantity: 1 }, { menuItemId: 'B', quantity: 1 }],
    }, user)
    const before = await combosCrud.getCombo(d, combo.id, user)
    expect(before.allergens).toEqual([])

    // Reemplaza el componente B (sin lactosa) por B2 (con lactosa) — sin tocar el combo directamente.
    await combosCrud.updateCombo(d, combo.id, {
      items: [{ menuItemId: 'A', quantity: 1 }, { menuItemId: 'B2', quantity: 1 }],
    }, user)

    const after = await combosCrud.getCombo(d, combo.id, user)
    expect(after.allergens).toEqual(['lactose'])
  })

  it('componente sin allergens declarado (null/ausente) no aporta falso negativo', async () => {
    const d = comboDeps({
      itemsSeed: [
        { id: 'A', hotelId: 'h1', name: 'Hamburguesa', allergens: ['gluten'] },
        { id: 'B', hotelId: 'h1', name: 'Papas' },   // sin allergens nunca configurado
      ],
    })
    const combo = await combosCrud.createCombo(d, {
      name: 'Combo Familiar', price: 800,
      items: [{ menuItemId: 'A', quantity: 1 }, { menuItemId: 'B', quantity: 1 }],
    }, user)

    const fetched = await combosCrud.getCombo(d, combo.id, user)
    expect(fetched.allergens).toEqual(['gluten'])   // solo lo declarado, no un array vacío falso
  })

  it('CreateComboSchema descarta allergens si llega en el body (no se persiste, whitelist mem 1805)', async () => {
    // El schema (validators/schema.ts) NO declara `allergens` en CreateComboSchema/UpdateComboSchema:
    // validateSchema lo descarta antes de llegar al usecase. Este test cubre el contrato del usecase:
    // aunque el input TS no exponga `allergens` en CreateComboInput, un objeto con esa propiedad extra
    // (simulando que el whitelist NO lo hubiese filtrado) no debe persistirse como columna propia —
    // el combo no tiene esa columna, así que igual se recalcula al leer.
    const d = comboDeps({ itemsSeed: [{ id: 'A', hotelId: 'h1', name: 'Hamburguesa', allergens: ['gluten'] }] })
    const dto: any = { name: 'Combo Familiar', price: 800, items: [{ menuItemId: 'A', quantity: 1 }], allergens: ['spicy'] }
    const combo = await combosCrud.createCombo(d, dto, user)
    const fetched = await combosCrud.getCombo(d, combo.id, user)
    // Derivado de sus componentes (gluten), NUNCA lo que se intentó forzar en el body (spicy).
    expect(fetched.allergens).toEqual(['gluten'])
  })
})
