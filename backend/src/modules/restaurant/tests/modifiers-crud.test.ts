// restaurant/tests/modifiers-crud.test.ts — CRUD de grupos de modificadores y sus opciones (F1).
// Usa RepositoryAdapter mock respaldado por un store en memoria — sin SQLite/Postgres.
import { describe, it, expect } from 'bun:test'
import type { RepositoryAdapter, Auth } from 'arckode-framework'
import * as modifiersCrud from '../usecases/modifiers-crud'
import type { ModifierGroupDTO, ModifierDTO, MenuItemDTO, CurrentUser } from '../types'

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

function deps(overrides: Partial<{ groupsStore: any[]; modifiersStore: any[]; itemsSeed: any[] }> = {}): modifiersCrud.ModifiersCrudDeps {
  return {
    modifierGroups: backed<ModifierGroupDTO>(overrides.groupsStore ?? []),
    modifiers: backed<ModifierDTO>(overrides.modifiersStore ?? []),
    items: backed<MenuItemDTO>([], overrides.itemsSeed ?? [{ id: 'm1', hotelId: 'h1', name: 'Hamburguesa' }]),
    userRepo: makeUserRepo(),
    auth: strictAuth,
  }
}

describe('modifiers-crud — grupos', () => {
  it('crea un grupo para un ítem del mismo hotel', async () => {
    const d = deps()
    const g = await modifiersCrud.createGroup(d, 'm1', { name: 'Tamaño', selectionType: 'single', required: 1 }, user)
    expect(g.hotelId).toBe('h1')
    expect(g.menuItemId).toBe('m1')
    expect(g.selectionType).toBe('single')
    expect(g.required).toBe(1)
  })

  it('rechaza crear un grupo para un menuItemId de OTRO hotel (400)', async () => {
    const d = deps({ itemsSeed: [{ id: 'm1', hotelId: 'OTRO', name: 'X' }] })
    await expect(modifiersCrud.createGroup(d, 'm1', { name: 'Tamaño' }, user)).rejects.toThrow('otro hotel')
  })

  it('rechaza grupo sin nombre', async () => {
    const d = deps()
    await expect(modifiersCrud.createGroup(d, 'm1', { name: '  ' }, user)).rejects.toThrow()
  })

  it('lista grupos de un ítem ordenados por sortOrder', async () => {
    const groupsStore = [
      { id: 'g2', hotelId: 'h1', menuItemId: 'm1', name: 'Extras', sortOrder: 2 },
      { id: 'g1', hotelId: 'h1', menuItemId: 'm1', name: 'Tamaño', sortOrder: 1 },
    ]
    const d = deps({ groupsStore })
    const res = await modifiersCrud.listGroups(d, 'm1', user)
    expect(res.data.map((g) => g.name)).toEqual(['Tamaño', 'Extras'])
  })

  it('borra un grupo Y sus opciones en la misma operación (cascada)', async () => {
    const groupsStore = [{ id: 'g1', hotelId: 'h1', menuItemId: 'm1', name: 'Tamaño' }]
    const modifiersStore = [
      { id: 'o1', hotelId: 'h1', groupId: 'g1', name: 'Chico', priceDelta: 0 },
      { id: 'o2', hotelId: 'h1', groupId: 'g1', name: 'Grande', priceDelta: 50 },
    ]
    const d = deps({ groupsStore, modifiersStore })
    await modifiersCrud.deleteGroup(d, 'g1', user)
    expect(groupsStore.length).toBe(0)
    expect(modifiersStore.length).toBe(0)
  })

  it('IDOR: actualizar/borrar un grupo de otro hotel es inaccesible', async () => {
    const groupsStore = [{ id: 'g1', hotelId: 'OTRO', menuItemId: 'm1', name: 'Tamaño' }]
    const d = deps({ groupsStore })
    await expect(modifiersCrud.updateGroup(d, 'g1', { name: 'x' }, user)).rejects.toThrow('IDOR')
    await expect(modifiersCrud.deleteGroup(d, 'g1', user)).rejects.toThrow('IDOR')
  })
})

describe('modifiers-crud — opciones', () => {
  it('crea una opción con priceDelta negativo (descuento)', async () => {
    const groupsStore = [{ id: 'g1', hotelId: 'h1', menuItemId: 'm1', name: 'Extras' }]
    const d = deps({ groupsStore })
    const o = await modifiersCrud.createModifier(d, 'g1', { name: 'Sin papas', priceDelta: -30 }, user)
    expect(o.priceDelta).toBe(-30)
    expect(o.groupId).toBe('g1')
  })

  it('rechaza opción con priceDelta no numérico', async () => {
    const groupsStore = [{ id: 'g1', hotelId: 'h1', menuItemId: 'm1', name: 'Extras' }]
    const d = deps({ groupsStore })
    await expect(modifiersCrud.createModifier(d, 'g1', { name: 'X', priceDelta: NaN }, user)).rejects.toThrow()
  })

  it('rechaza crear opción sobre un grupo de OTRO hotel', async () => {
    const groupsStore = [{ id: 'g1', hotelId: 'OTRO', menuItemId: 'm1', name: 'Extras' }]
    const d = deps({ groupsStore })
    await expect(modifiersCrud.createModifier(d, 'g1', { name: 'X', priceDelta: 10 }, user)).rejects.toThrow('otro hotel')
  })

  it('IDOR: actualizar/borrar una opción de otro hotel es inaccesible', async () => {
    const modifiersStore = [{ id: 'o1', hotelId: 'OTRO', groupId: 'g1', name: 'Grande', priceDelta: 50 }]
    const d = deps({ modifiersStore })
    await expect(modifiersCrud.updateModifier(d, 'o1', { priceDelta: 70 }, user)).rejects.toThrow('IDOR')
    await expect(modifiersCrud.deleteModifier(d, 'o1', user)).rejects.toThrow('IDOR')
  })
})
