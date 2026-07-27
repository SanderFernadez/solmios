// inventario/tests/consume-with-modifiers.test.ts — consumeForSaleWithModifiers (F1, carta-experiencia-avanzada).
// Descuenta el insumo declarado por cada modificador elegido en el snapshot de la línea, ADEMÁS de la
// receta base (consumeForSale, cubierto en service.test.ts). Dedup por (source,sourceId) vía applyMovement.
import { describe, it, expect } from 'bun:test'
import type { RepositoryAdapter, Auth } from 'arckode-framework'
import { silentLogger } from 'arckode-framework/testing'
import { consumeForSaleWithModifiers, type RecipeDeps } from '../usecases/recipes'
import type { InventoryItemDTO, StockMovementDTO, MenuItemRecipeDTO, CurrentUser } from '../types'

const log = silentLogger()
const passAuth: Auth = { assertOwnership: () => {}, authenticate: (() => []) as any } as unknown as Auth
const sys: CurrentUser = { id: 'system', hotelId: 'h1', role: 'super_admin' }

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

function setup() {
  const itemsStore: any[] = [{ id: 'ing-tocino', hotelId: 'h1', name: 'Tocino', currentStock: 100, avgCost: 5, unit: 'un' }]
  const movStore: any[] = []
  const deps: RecipeDeps = {
    recipes: backed<MenuItemRecipeDTO>([]),
    items: backed<InventoryItemDTO>(itemsStore),
    movements: backed<StockMovementDTO>(movStore),
    userRepo: makeUserRepo(), auth: passAuth, logger: log,
  }
  return { deps, itemsStore, movStore }
}

describe('consumeForSaleWithModifiers (F1)', () => {
  it('modificador con receta propia descuenta insumo extra (sourceId distinto de la receta base)', async () => {
    const { deps, movStore } = setup()
    const line = {
      id: 'l1', quantity: 1,
      modifiers: [{ groupId: 'gExtras', groupName: 'Extras', modifierId: 'oTocino', name: '+tocino', priceDelta: 80, inventoryItemId: 'ing-tocino', inventoryQuantity: 2 }],
    }
    await consumeForSaleWithModifiers(deps, { hotelId: 'h1', line }, sys)
    expect(movStore).toHaveLength(1)
    expect(movStore[0].itemId).toBe('ing-tocino')
    expect(movStore[0].quantity).toBe(2)
    expect(movStore[0].type).toBe('out')
    expect(movStore[0].source).toBe('pos_sale')
    expect(movStore[0].sourceId).toBe('l1:oTocino:ing-tocino')
  })

  it('modificador sin inventoryItemId declarado no genera movimiento adicional', async () => {
    const { deps, movStore } = setup()
    const line = {
      id: 'l1', quantity: 1,
      modifiers: [{ groupId: 'gSize', groupName: 'Tamaño', modifierId: 'oGrande', name: 'Grande', priceDelta: 50 }],
    }
    await consumeForSaleWithModifiers(deps, { hotelId: 'h1', line }, sys)
    expect(movStore).toHaveLength(0)
  })

  it('reintentar la liquidación no duplica el movimiento (dedup por source+sourceId)', async () => {
    const { deps, movStore } = setup()
    const line = {
      id: 'l1', quantity: 1,
      modifiers: [{ groupId: 'gExtras', groupName: 'Extras', modifierId: 'oTocino', name: '+tocino', priceDelta: 80, inventoryItemId: 'ing-tocino', inventoryQuantity: 2 }],
    }
    await consumeForSaleWithModifiers(deps, { hotelId: 'h1', line }, sys)
    await consumeForSaleWithModifiers(deps, { hotelId: 'h1', line }, sys)   // reintento (evento duplicado)
    expect(movStore).toHaveLength(1)
  })

  it('quantity multiplica el consumo del modificador', async () => {
    const { deps, movStore } = setup()
    const line = {
      id: 'l1', quantity: 3,
      modifiers: [{ groupId: 'gExtras', groupName: 'Extras', modifierId: 'oTocino', name: '+tocino', priceDelta: 80, inventoryItemId: 'ing-tocino', inventoryQuantity: 2 }],
    }
    await consumeForSaleWithModifiers(deps, { hotelId: 'h1', line }, sys)
    expect(movStore[0].quantity).toBe(6)   // 2 × 3
  })

  it('línea sin modifiers (null/ausente) no hace nada', async () => {
    const { deps, movStore } = setup()
    await consumeForSaleWithModifiers(deps, { hotelId: 'h1', line: { id: 'l1', quantity: 1, modifiers: null } }, sys)
    expect(movStore).toHaveLength(0)
  })
})
