// restaurant/tests/i18n.test.ts — Multi-idioma de carta (F4). Cubre TODOS los scenarios de
// specs/menu-i18n/spec.md: traducción completa, parcial (fallback campo por campo), idioma sin
// ninguna traducción cargada (cae a español), lang=es explícito ignora el mapa, clave 'es' rechazada
// en categoría/ítem/combo, y consistencia combo+ítem traducidos en la misma categoría.
import { describe, it, expect } from 'bun:test'
import type { RepositoryAdapter, Auth } from 'arckode-framework'
import * as categoriesCrud from '../usecases/categories-crud'
import * as itemsCrud from '../usecases/items-crud'
import * as combosCrud from '../usecases/combos-crud'
import type { CategoryDTO, MenuItemDTO, StationDTO, ComboDTO, ComboItemDTO, CurrentUser } from '../types'

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

// ─── Categorías ───
function catDeps(overrides: Partial<{ categoriesStore: any[]; itemsSeed: any[] }> = {}): categoriesCrud.CategoriesCrudDeps {
  return {
    categories: backed<CategoryDTO>(overrides.categoriesStore ?? []),
    items: backed<MenuItemDTO>([], overrides.itemsSeed ?? []),
    stations: backed<StationDTO>([]),
    userRepo: makeUserRepo(),
    auth: strictAuth,
  }
}

describe('i18n — categorías', () => {
  it('rechaza translations con la clave es', async () => {
    const d = catDeps()
    await expect(categoriesCrud.createCategory(d, {
      name: 'Entradas', translations: { es: { name: 'x' } } as any,
    }, user)).rejects.toThrow('El idioma base (es) no se traduce; usá el campo name')
  })

  it('traduce el nombre de una categoría al inglés', async () => {
    const d = catDeps()
    const created = await categoriesCrud.createCategory(d, {
      name: 'Entradas', translations: { en: { name: 'Appetizers' } },
    }, user)
    expect(created.name).toBe('Entradas')

    const inEn = await categoriesCrud.getCategory(d, created.id, user, 'en')
    expect(inEn.name).toBe('Appetizers')
    expect(inEn.translations).toBeUndefined()
  })

  it('lang=es explícito ignora el mapa de traducciones', async () => {
    const d = catDeps()
    const created = await categoriesCrud.createCategory(d, {
      name: 'Entradas', translations: { en: { name: 'Appetizers' } },
    }, user)
    const inEs = await categoriesCrud.getCategory(d, created.id, user, 'es')
    expect(inEs.name).toBe('Entradas')
  })

  it('idioma sin ninguna traducción cargada cae a español', async () => {
    const d = catDeps()
    const created = await categoriesCrud.createCategory(d, { name: 'Entradas' }, user)
    const inFr = await categoriesCrud.getCategory(d, created.id, user, 'fr')
    expect(inFr.name).toBe('Entradas')
  })
})

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

describe('i18n — ítems', () => {
  it('rechaza translations con la clave es', async () => {
    const d = itemDeps()
    await expect(itemsCrud.createItem(d, {
      categoryId: 'cat1', name: 'Hamburguesa', price: 100,
      translations: { es: { name: 'x' } } as any,
    }, user)).rejects.toThrow('El idioma base (es) no se traduce; usá el campo name/description')
  })

  it('traducción completa: name + description en inglés', async () => {
    const d = itemDeps()
    const created = await itemsCrud.createItem(d, {
      categoryId: 'cat1', name: 'Hamburguesa', description: 'Con papas y ensalada', price: 100,
      translations: { en: { name: 'Burger', description: 'With fries and salad' } },
    }, user)
    expect(created.name).toBe('Hamburguesa')   // base intacto

    const inEn = await itemsCrud.getItem(d, created.id, user, 'en')
    expect(inEn.name).toBe('Burger')
    expect(inEn.description).toBe('With fries and salad')
    expect(inEn.translations).toBeUndefined()
  })

  it('traducción parcial: solo el nombre — description cae a español (fallback campo por campo)', async () => {
    const d = itemDeps()
    const created = await itemsCrud.createItem(d, {
      categoryId: 'cat1', name: 'Papas', description: 'Papas fritas caseras', price: 50,
      translations: { en: { name: 'Fries' } },
    }, user)
    const inEn = await itemsCrud.getItem(d, created.id, user, 'en')
    expect(inEn.name).toBe('Fries')
    expect(inEn.description).toBe('Papas fritas caseras')
  })

  it('idioma sin ninguna traducción (fr) cae a español, no vacío ni error', async () => {
    const d = itemDeps()
    const created = await itemsCrud.createItem(d, { categoryId: 'cat1', name: 'Refresco', description: 'Bebida fría', price: 30 }, user)
    const inFr = await itemsCrud.getItem(d, created.id, user, 'fr')
    expect(inFr.name).toBe('Refresco')
    expect(inFr.description).toBe('Bebida fría')
  })

  it('lang=es explícito ignora translations.en cargado', async () => {
    const d = itemDeps()
    const created = await itemsCrud.createItem(d, {
      categoryId: 'cat1', name: 'Hamburguesa', description: 'Con papas', price: 100,
      translations: { en: { name: 'Burger', description: 'With fries' } },
    }, user)
    const inEs = await itemsCrud.getItem(d, created.id, user, 'es')
    expect(inEs.name).toBe('Hamburguesa')
    expect(inEs.description).toBe('Con papas')
  })

  it('GET sin ?lang= devuelve translations crudo completo (para el editor de carta.vue)', async () => {
    const d = itemDeps()
    const created = await itemsCrud.createItem(d, {
      categoryId: 'cat1', name: 'Hamburguesa', price: 100,
      translations: { en: { name: 'Burger' } },
    }, user)
    const raw = await itemsCrud.getItem(d, created.id, user)
    expect(raw.translations).toEqual({ en: { name: 'Burger' } })
  })

  it('updateItem rechaza translations con clave es', async () => {
    const d = itemDeps()
    const created = await itemsCrud.createItem(d, { categoryId: 'cat1', name: 'Refresco', price: 30 }, user)
    await expect(itemsCrud.updateItem(d, created.id, { translations: { es: { name: 'x' } } as any }, user))
      .rejects.toThrow('El idioma base (es) no se traduce; usá el campo name/description')
  })
})

// ─── Combos ───
function comboDeps(overrides: Partial<{ combosStore: any[]; comboItemsStore: any[]; itemsSeed: any[] }> = {}): combosCrud.CombosCrudDeps {
  return {
    combos: backed<ComboDTO>(overrides.combosStore ?? []),
    comboItems: backed<ComboItemDTO>(overrides.comboItemsStore ?? []),
    items: backed<MenuItemDTO>([], overrides.itemsSeed ?? [{ id: 'A', hotelId: 'h1', name: 'Hamburguesa' }]),
    userRepo: makeUserRepo(),
    auth: strictAuth,
  }
}

describe('i18n — combos', () => {
  it('rechaza translations con la clave es', async () => {
    const d = comboDeps()
    await expect(combosCrud.createCombo(d, {
      name: 'Combo Familiar', price: 800, items: [{ menuItemId: 'A', quantity: 1 }],
      translations: { es: { name: 'x' } } as any,
    }, user)).rejects.toThrow('El idioma base (es) no se traduce; usá el campo name/description')
  })

  it('combo traducido a en persiste translations.en.name', async () => {
    const d = comboDeps()
    const created = await combosCrud.createCombo(d, {
      name: 'Combo Familiar', price: 800, items: [{ menuItemId: 'A', quantity: 1 }],
      translations: { en: { name: 'Family Combo' } },
    }, user)
    expect(created.translations).toEqual({ en: { name: 'Family Combo' } })

    const inEn = await combosCrud.getCombo(d, created.id, user, 'en')
    expect(inEn.name).toBe('Family Combo')
    expect(inEn.translations).toBeUndefined()
  })

  it('consistencia: combo traducido + ítem traducido en la misma categoría, ambos en inglés', async () => {
    const iDeps = itemDeps({ itemsStore: [] })
    const hamburguesa = await itemsCrud.createItem(iDeps, {
      categoryId: 'cat1', name: 'Hamburguesa', price: 100,
      translations: { en: { name: 'Burger' } },
    }, user)

    const cDeps = comboDeps({ itemsSeed: [{ id: hamburguesa.id, hotelId: 'h1', name: 'Hamburguesa' }] })
    const combo = await combosCrud.createCombo(cDeps, {
      name: 'Combo Familiar', price: 800, items: [{ menuItemId: hamburguesa.id, quantity: 1 }],
      translations: { en: { name: 'Family Combo' } },
    }, user)

    const itemInEn = await itemsCrud.getItem(iDeps, hamburguesa.id, user, 'en')
    const comboInEn = await combosCrud.getCombo(cDeps, combo.id, user, 'en')
    expect(itemInEn.name).toBe('Burger')
    expect(comboInEn.name).toBe('Family Combo')
  })
})
