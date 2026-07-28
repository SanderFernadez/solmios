// restaurant/tests/combos-crud.test.ts — CRUD de combos/paquetes (F2).
// Cubre los scenarios de specs/menu-combos/spec.md "Definición de un combo": alta con N componentes,
// componente de otro hotel rechazado, y ownership (IDOR) en get/update/delete.
import { describe, it, expect } from 'bun:test'
import type { RepositoryAdapter, Auth } from 'arckode-framework'
import * as combosCrud from '../usecases/combos-crud'
import type { ComboDTO, ComboItemDTO, MenuItemDTO, CurrentUser } from '../types'

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

// A/B/C = Hamburguesa/Papas/Refresco, todos del hotel h1.
const ITEMS_SEED = [
  { id: 'A', hotelId: 'h1', name: 'Hamburguesa' },
  { id: 'B', hotelId: 'h1', name: 'Papas' },
  { id: 'C', hotelId: 'h1', name: 'Refresco' },
]

function deps(overrides: Partial<{ combosStore: any[]; comboItemsStore: any[]; itemsSeed: any[] }> = {}): combosCrud.CombosCrudDeps {
  return {
    combos: backed<ComboDTO>(overrides.combosStore ?? []),
    comboItems: backed<ComboItemDTO>(overrides.comboItemsStore ?? []),
    items: backed<MenuItemDTO>([], overrides.itemsSeed ?? ITEMS_SEED),
    userRepo: makeUserRepo(),
    auth: strictAuth,
  }
}

describe('combos-crud — alta', () => {
  it('crea "Combo Familiar" con 3 componentes del mismo hotel', async () => {
    const d = deps()
    const combo = await combosCrud.createCombo(d, {
      name: 'Combo Familiar',
      price: 800,
      items: [
        { menuItemId: 'A', quantity: 2 },
        { menuItemId: 'B', quantity: 1 },
        { menuItemId: 'C', quantity: 2 },
      ],
    }, user)
    expect(combo.hotelId).toBe('h1')
    expect(combo.name).toBe('Combo Familiar')
    expect(combo.price).toBe(800)
    expect(combo.items).toHaveLength(3)
    expect(combo.items?.map((i) => i.menuItemId).sort()).toEqual(['A', 'B', 'C'])
  })

  it('rechaza un componente de OTRO hotel (400: "El ítem no existe o es de otro hotel")', async () => {
    const d = deps({ itemsSeed: [{ id: 'A', hotelId: 'h1', name: 'Hamburguesa' }, { id: 'X', hotelId: 'OTRO', name: 'Ajena' }] })
    await expect(combosCrud.createCombo(d, {
      name: 'Combo Intruso', price: 500,
      items: [{ menuItemId: 'A', quantity: 1 }, { menuItemId: 'X', quantity: 1 }],
    }, user)).rejects.toThrow('otro hotel')
  })

  it('rechaza combo sin nombre', async () => {
    const d = deps()
    await expect(combosCrud.createCombo(d, { name: '  ', price: 100, items: [{ menuItemId: 'A', quantity: 1 }] }, user)).rejects.toThrow()
  })

  it('rechaza combo sin componentes', async () => {
    const d = deps()
    await expect(combosCrud.createCombo(d, { name: 'Vacío', price: 100, items: [] }, user)).rejects.toThrow('al menos un componente')
  })

  it('rechaza precio negativo', async () => {
    const d = deps()
    await expect(combosCrud.createCombo(d, { name: 'X', price: -1, items: [{ menuItemId: 'A', quantity: 1 }] }, user)).rejects.toThrow()
  })
})

describe('combos-crud — lectura y edición', () => {
  it('lista combos del hotel ordenados por sortOrder, con items adjuntos', async () => {
    const combosStore = [
      { id: 'c2', hotelId: 'h1', name: 'Combo B', price: 500, sortOrder: 2 },
      { id: 'c1', hotelId: 'h1', name: 'Combo A', price: 300, sortOrder: 1 },
    ]
    const comboItemsStore = [{ id: 'ci1', hotelId: 'h1', comboId: 'c1', menuItemId: 'A', quantity: 1 }]
    const d = deps({ combosStore, comboItemsStore })
    const res = await combosCrud.listCombos(d, user)
    expect(res.data.map((c) => c.name)).toEqual(['Combo A', 'Combo B'])
    expect(res.data[0].items).toHaveLength(1)
  })

  it('actualiza el combo y reemplaza items COMPLETO si viene', async () => {
    const combosStore = [{ id: 'c1', hotelId: 'h1', name: 'Combo Familiar', price: 800 }]
    const comboItemsStore = [
      { id: 'ci1', hotelId: 'h1', comboId: 'c1', menuItemId: 'A', quantity: 2 },
      { id: 'ci2', hotelId: 'h1', comboId: 'c1', menuItemId: 'B', quantity: 1 },
    ]
    const d = deps({ combosStore, comboItemsStore })
    const updated = await combosCrud.updateCombo(d, 'c1', { items: [{ menuItemId: 'C', quantity: 3 }] }, user)
    expect(updated.items).toHaveLength(1)
    expect(updated.items?.[0].menuItemId).toBe('C')
    expect(comboItemsStore.filter((i) => i.comboId === 'c1')).toHaveLength(1)
  })

  it('rechaza update con componente de OTRO hotel', async () => {
    const combosStore = [{ id: 'c1', hotelId: 'h1', name: 'Combo Familiar', price: 800 }]
    const d = deps({ combosStore, itemsSeed: [{ id: 'X', hotelId: 'OTRO', name: 'Ajena' }] })
    await expect(combosCrud.updateCombo(d, 'c1', { items: [{ menuItemId: 'X', quantity: 1 }] }, user)).rejects.toThrow('otro hotel')
  })

  it('borra un combo Y sus componentes en la misma operación', async () => {
    const combosStore = [{ id: 'c1', hotelId: 'h1', name: 'Combo Familiar', price: 800 }]
    const comboItemsStore = [
      { id: 'ci1', hotelId: 'h1', comboId: 'c1', menuItemId: 'A', quantity: 2 },
      { id: 'ci2', hotelId: 'h1', comboId: 'c1', menuItemId: 'B', quantity: 1 },
    ]
    const d = deps({ combosStore, comboItemsStore })
    await combosCrud.deleteCombo(d, 'c1', user)
    expect(combosStore).toHaveLength(0)
    expect(comboItemsStore).toHaveLength(0)
  })
})

describe('combos-crud — IDOR', () => {
  it('getCombo/updateCombo/deleteCombo de un combo de OTRO hotel son inaccesibles', async () => {
    const combosStore = [{ id: 'c1', hotelId: 'OTRO', name: 'Ajeno', price: 100 }]
    const d = deps({ combosStore })
    await expect(combosCrud.getCombo(d, 'c1', user)).rejects.toThrow('IDOR')
    await expect(combosCrud.updateCombo(d, 'c1', { name: 'x' }, user)).rejects.toThrow('IDOR')
    await expect(combosCrud.deleteCombo(d, 'c1', user)).rejects.toThrow('IDOR')
  })

  it('crear/listar/actualizar/borrar un combo inexistente responde 404', async () => {
    const d = deps()
    await expect(combosCrud.getCombo(d, 'no-existe', user)).rejects.toThrow('no encontrado')
    await expect(combosCrud.updateCombo(d, 'no-existe', { name: 'x' }, user)).rejects.toThrow('no encontrado')
    await expect(combosCrud.deleteCombo(d, 'no-existe', user)).rejects.toThrow('no encontrado')
  })
})
