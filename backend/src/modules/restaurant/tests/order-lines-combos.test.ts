// restaurant/tests/order-lines-combos.test.ts — addLine/updateLine/removeLine con combos (F2).
// Cubre los scenarios de specs/menu-combos/spec.md: 1 header + N componentes, multiplicación de
// cantidades, ruteo por estación de cada componente, comboId+modifiers rechazado, propagación de
// cantidad header→componentes, borrado en cascada, y edición directa de un componente rechazada.
import { describe, it, expect } from 'bun:test'
import type { RepositoryAdapter, Auth } from 'arckode-framework'
import { addLine, updateLine, removeLine, type OrderLinesDeps } from '../usecases/order-lines'
import type { OrderDTO, OrderItemDTO, MenuItemDTO, CategoryDTO, StationDTO, ComboDTO, ComboItemDTO, CurrentUser } from '../types'

// Reloj fijo para DT-10 (mismo patrón que availability.test.ts) — isWithinAvailabilityWindow usa
// `new Date()` internamente, se sobreescribe SOLO durante el test y se restaura siempre.
let restoreClock: (() => void) | null = null
function mockClock(hour: number, minute: number): void {
  const RealDate = Date
  class FixedDate extends RealDate {
    constructor(...args: any[]) {
      if (args.length === 0) { super(); this.setHours(hour, minute, 0, 0) }
      // @ts-expect-error - passthrough variádico al constructor real de Date
      else super(...args)
    }
    static now(): number {
      const d = new RealDate()
      d.setHours(hour, minute, 0, 0)
      return d.getTime()
    }
  }
  // @ts-expect-error - override deliberado, test-only
  globalThis.Date = FixedDate
  restoreClock = () => { globalThis.Date = RealDate }
}

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

// Setup: comanda abierta o1. Combo Familiar (price 800) = 2×Hamburguesa(Cocina) + 1×Papas(Cocina) +
// 2×Refresco(Bar). Estaciones/categoría resueltas vía resolveStation() sin cambios.
function setup() {
  const ordersStore: any[] = [{ id: 'o1', hotelId: 'h1', status: 'open', tip: 0, subtotal: 0, tax: 0, total: 0 }]
  const linesStore: any[] = []
  const combosStore: any[] = [{ id: 'combo1', hotelId: 'h1', name: 'Combo Familiar', price: 800, taxRate: 0 }]
  const comboItemsStore: any[] = [
    { id: 'ci-A', hotelId: 'h1', comboId: 'combo1', menuItemId: 'A', quantity: 2, sortOrder: 0 },
    { id: 'ci-B', hotelId: 'h1', comboId: 'combo1', menuItemId: 'B', quantity: 1, sortOrder: 1 },
    { id: 'ci-C', hotelId: 'h1', comboId: 'combo1', menuItemId: 'C', quantity: 2, sortOrder: 2 },
  ]
  const itemsSeed = [
    { id: 'A', hotelId: 'h1', name: 'Hamburguesa', price: 250, categoryId: 'cat-cocina', available: 1, stationId: undefined },
    { id: 'B', hotelId: 'h1', name: 'Papas', price: 100, categoryId: 'cat-cocina', available: 1, stationId: undefined },
    { id: 'C', hotelId: 'h1', name: 'Refresco', price: 50, categoryId: 'cat-bar', available: 1, stationId: undefined },
  ]
  const categoriesSeed = [
    { id: 'cat-cocina', hotelId: 'h1', name: 'Cocina', stationId: 'st-cocina' },
    { id: 'cat-bar', hotelId: 'h1', name: 'Bar', stationId: 'st-bar' },
  ]
  const stationsSeed = [
    { id: 'st-cocina', hotelId: 'h1', name: 'Cocina', active: 1, sortOrder: 0 },
    { id: 'st-bar', hotelId: 'h1', name: 'Bar', active: 1, sortOrder: 1 },
  ]
  const items = backed<MenuItemDTO>([], itemsSeed)
  const categories = backed<CategoryDTO>([], categoriesSeed)
  const stations = backed<StationDTO>([], stationsSeed)
  const config = makeRepo<any>({ findOne: async () => null })
  const hotels = makeRepo<any>({ findById: async () => ({ id: 'h1', taxRate: 0 }) })

  const deps: OrderLinesDeps = {
    orders: backed<OrderDTO>(ordersStore),
    lines: backed<OrderItemDTO>(linesStore),
    items, categories, stations, config, hotels,
    userRepo: makeUserRepo(), auth: strictAuth,
    combos: backed<ComboDTO>(combosStore),
    comboItems: backed<ComboItemDTO>(comboItemsStore),
  }
  return { deps, ordersStore, linesStore, combosStore, comboItemsStore }
}

describe('addLine — combos (F2)', () => {
  it('vender 1 unidad genera 1 header + 3 componentes; lineTotal correcto', async () => {
    const { deps, linesStore } = setup()
    const header = await addLine(deps, 'o1', { comboId: 'combo1', quantity: 1 }, user)

    expect(header.name).toBe('Combo Familiar')
    expect(header.unitPrice).toBe(800)
    expect(header.lineTotal).toBe(800)
    expect((header as any).kind).toBe('combo_header')
    expect((header as any).comboId).toBe('combo1')

    expect(linesStore).toHaveLength(4)   // 1 header + 3 componentes
    const components = linesStore.filter((l) => l.kind === 'combo_component')
    expect(components).toHaveLength(3)
    for (const c of components) {
      expect(c.unitPrice).toBe(0)
      expect(c.lineTotal).toBe(0)
      expect(c.parentLineId).toBe(header.id)
    }
    const byItem = Object.fromEntries(components.map((c: any) => [c.menuItemId, c.quantity]))
    expect(byItem).toEqual({ A: 2, B: 1, C: 2 })
  })

  it('recomputeTotals suma 800 (header) + 0 + 0 + 0 = 800', async () => {
    const { deps, ordersStore } = setup()
    await addLine(deps, 'o1', { comboId: 'combo1', quantity: 1 }, user)
    expect(ordersStore[0].subtotal).toBe(800)
  })

  it('vender 2 unidades multiplica cantidades de componentes y el total del header', async () => {
    const { deps, linesStore } = setup()
    const header = await addLine(deps, 'o1', { comboId: 'combo1', quantity: 2 }, user)
    expect(header.quantity).toBe(2)
    expect(header.lineTotal).toBe(1600)
    const components = linesStore.filter((l) => l.kind === 'combo_component')
    const byItem = Object.fromEntries(components.map((c: any) => [c.menuItemId, c.quantity]))
    expect(byItem).toEqual({ A: 4, B: 2, C: 4 })
  })

  it('cada componente rutea a su propia estación (Cocina vs Bar)', async () => {
    const { deps, linesStore } = setup()
    await addLine(deps, 'o1', { comboId: 'combo1', quantity: 1 }, user)
    const components = linesStore.filter((l) => l.kind === 'combo_component')
    const stationByItem = Object.fromEntries(components.map((c: any) => [c.menuItemId, c.stationId]))
    expect(stationByItem.A).toBe('st-cocina')
    expect(stationByItem.B).toBe('st-cocina')
    expect(stationByItem.C).toBe('st-bar')
  })

  it('comboId + modifiers juntos → 400, no crea ninguna fila', async () => {
    const { deps, linesStore } = setup()
    await expect(addLine(deps, 'o1', { comboId: 'combo1', quantity: 1, modifiers: [{ modifierId: 'm1' }] }, user))
      .rejects.toThrow('no están permitidos')
    expect(linesStore).toHaveLength(0)
  })

  it('menuItemId + comboId juntos (ambos) → 400', async () => {
    const { deps } = setup()
    await expect(addLine(deps, 'o1', { comboId: 'combo1', menuItemId: 'A', quantity: 1 }, user))
      .rejects.toThrow('exactamente uno')
  })

  it('ningún comboId/menuItemId → 400', async () => {
    const { deps } = setup()
    await expect(addLine(deps, 'o1', { quantity: 1 }, user)).rejects.toThrow('exactamente uno')
  })

  it('combo inexistente o de otro hotel se rechaza', async () => {
    const { deps } = setup()
    await expect(addLine(deps, 'o1', { comboId: 'no-existe', quantity: 1 }, user)).rejects.toThrow()
  })
})

// DT-10 — un componente 86'd o fuera de franja horaria rechaza el combo COMPLETO, sin crear
// ninguna fila (ni header ni componentes) — mismo criterio que un ítem suelto vía addLine.
describe('addLine — combos: DT-10 disponibilidad de componentes', () => {
  it('componente con available:0 → 400, no crea ninguna fila (ni header)', async () => {
    const { deps, linesStore } = setup()
    const item = await deps.items.findOne({ id: 'B' })
    await deps.items.update('B', { ...item, available: 0 })
    await expect(addLine(deps, 'o1', { comboId: 'combo1', quantity: 1 }, user))
      .rejects.toThrow('"Papas" no está disponible ahora mismo')
    expect(linesStore).toHaveLength(0)
  })

  it('componente fuera de franja horaria → 400, no crea ninguna fila', async () => {
    const { deps, linesStore } = setup()
    const item = await deps.items.findOne({ id: 'C' })
    await deps.items.update('C', { ...item, availableFrom: '18:00', availableTo: '23:00' })
    mockClock(10, 0) // 10:00am — fuera de la franja 18:00-23:00 de Refresco
    try {
      await expect(addLine(deps, 'o1', { comboId: 'combo1', quantity: 1 }, user))
        .rejects.toThrow('"Refresco" no está disponible en este horario')
      expect(linesStore).toHaveLength(0)
    } finally {
      restoreClock?.()
    }
  })

  it('todos los componentes disponibles → sigue funcionando igual (regresión cero)', async () => {
    const { deps, linesStore } = setup()
    const header = await addLine(deps, 'o1', { comboId: 'combo1', quantity: 1 }, user)
    expect(header.name).toBe('Combo Familiar')
    expect(linesStore).toHaveLength(4)
  })
})

describe('updateLine — combos (F2)', () => {
  it('cambiar la cantidad del header propaga a TODOS los componentes', async () => {
    const { deps, linesStore } = setup()
    const header = await addLine(deps, 'o1', { comboId: 'combo1', quantity: 1 }, user)

    const updated = await updateLine(deps, 'o1', header.id, { quantity: 3 }, user)
    expect(updated.quantity).toBe(3)
    expect(updated.lineTotal).toBe(2400)   // 800 × 3

    const components = linesStore.filter((l) => l.kind === 'combo_component')
    const byItem = Object.fromEntries(components.map((c: any) => [c.menuItemId, c.quantity]))
    expect(byItem).toEqual({ A: 6, B: 3, C: 6 })   // qty base × 3
  })

  it('editar un componente DIRECTAMENTE (sin pasar por el header) se rechaza (400)', async () => {
    const { deps, linesStore } = setup()
    await addLine(deps, 'o1', { comboId: 'combo1', quantity: 1 }, user)
    const component = linesStore.find((l) => l.kind === 'combo_component')
    await expect(updateLine(deps, 'o1', component.id, { quantity: 5 }, user))
      .rejects.toThrow('editá el combo completo')
  })
})

describe('removeLine — combos (F2)', () => {
  it('borrar el header borra TODAS las filas del combo (header + componentes)', async () => {
    const { deps, linesStore } = setup()
    const header = await addLine(deps, 'o1', { comboId: 'combo1', quantity: 1 }, user)
    expect(linesStore).toHaveLength(4)

    await removeLine(deps, 'o1', header.id, user)
    expect(linesStore).toHaveLength(0)
  })

  it('recomputeTotals recalcula la orden sin el monto del combo tras borrarlo', async () => {
    const { deps, ordersStore } = setup()
    const header = await addLine(deps, 'o1', { comboId: 'combo1', quantity: 1 }, user)
    expect(ordersStore[0].subtotal).toBe(800)
    await removeLine(deps, 'o1', header.id, user)
    expect(ordersStore[0].subtotal).toBe(0)
  })

  it('borrar un componente DIRECTAMENTE se rechaza (400)', async () => {
    const { deps, linesStore } = setup()
    await addLine(deps, 'o1', { comboId: 'combo1', quantity: 1 }, user)
    const component = linesStore.find((l) => l.kind === 'combo_component')
    await expect(removeLine(deps, 'o1', component.id, user)).rejects.toThrow('editá el combo completo')
  })
})
