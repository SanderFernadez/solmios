// restaurant/tests/service.test.ts — Tests del servicio POS.
// RES-0: estaciones. RES-1: carta (categorías + ítems). RES-2: mesas.
// Usa RepositoryAdapter mock — sin dependencia de SQLite ni Postgres.
import { describe, it, expect } from 'bun:test'
import type { RepositoryAdapter, Auth } from 'arckode-framework'
import { silentLogger } from 'arckode-framework/testing'
import { RestaurantService } from '../service'
import type { StationDTO, CategoryDTO, MenuItemDTO, TableDTO, OrderDTO, CurrentUser } from '../types'

const log = silentLogger()
const passAuth: Auth = { assertOwnership: () => {}, authenticate: (() => []) as any } as unknown as Auth
// Auth que rechaza si el hotel del recurso no es el del usuario (simula el guard real).
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
    findMany: async () => [],
    findById: async () => null,
    findOne: async () => null,
    create: async (data: any) => ({ id: 'gen-id', ...data }),
    update: async (id: any, data: any) => ({ id, ...data }),
    delete: async () => true,
    count: async () => 0,
    paginate: async () => ({ data: [], total: 0, limit: 100, offset: 0, pages: 0 }),
    ...overrides,
  } as RepositoryAdapter<T>
}
function makeUserRepo(hotelId = 'h1'): RepositoryAdapter<any> {
  return { ...makeRepo<any>(), findById: async () => ({ id: 'u1', hotelId }) }
}

interface Repos {
  stations?: RepositoryAdapter<StationDTO>
  categories?: RepositoryAdapter<CategoryDTO>
  items?: RepositoryAdapter<MenuItemDTO>
  tables?: RepositoryAdapter<TableDTO>
}
function svc(r: Repos = {}, auth: Auth = passAuth, userHotel = 'h1') {
  return new RestaurantService(
    r.stations ?? makeRepo<StationDTO>(),
    r.categories ?? makeRepo<CategoryDTO>(),
    r.items ?? makeRepo<MenuItemDTO>(),
    r.tables ?? makeRepo<TableDTO>(),
    makeUserRepo(userHotel), log, auth,
  )
}

describe('RestaurantService — estaciones (RES-0)', () => {
  it('crea una estación forzando el hotelId del JWT (no del body)', async () => {
    let created: any = null
    const stations = makeRepo<StationDTO>({ create: async (d: any) => { created = d; return { id: 's1', ...d } } })
    const st = await svc({ stations }).createStation({ name: 'Cocina' }, user)
    expect(st.id).toBe('s1')
    expect(created.hotelId).toBe('h1')
    expect(created.active).toBe(1)
    expect(created.sortOrder).toBe(0)
  })

  it('rechaza estación sin nombre (ValidationError)', async () => {
    await expect(svc().createStation({ name: '   ' }, user)).rejects.toThrow()
  })

  it('lista estaciones del hotel ordenadas por sortOrder', async () => {
    const rows: StationDTO[] = [
      { id: 'b', hotelId: 'h1', name: 'Bar', sortOrder: 2 } as StationDTO,
      { id: 'a', hotelId: 'h1', name: 'Cocina', sortOrder: 1 } as StationDTO,
    ]
    const res = await svc({ stations: makeRepo<StationDTO>({ findMany: async () => rows.slice() }) }).listStations(user)
    expect(res.data[0].name).toBe('Cocina')
    expect(res.total).toBe(2)
  })

  it('getStation respeta ownership: estación de otro hotel es inaccesible', async () => {
    const stations = makeRepo<StationDTO>({ findById: async () => ({ id: 's1', hotelId: 'OTRO', name: 'Bar' } as StationDTO) })
    await expect(svc({ stations }, strictAuth).getStation('s1', user)).rejects.toThrow('IDOR')
  })
})

describe('RestaurantService — carta: categorías (RES-1)', () => {
  it('crea categoría con hotelId del JWT y valida la estación del mismo hotel', async () => {
    let created: any = null
    const stations = makeRepo<StationDTO>({ findOne: async () => ({ id: 'st1', hotelId: 'h1', name: 'Bar' } as StationDTO) })
    const categories = makeRepo<CategoryDTO>({ create: async (d: any) => { created = d; return { id: 'c1', ...d } } })
    const cat = await svc({ stations, categories }).createCategory({ name: 'Cócteles', stationId: 'st1' }, user)
    expect(cat.id).toBe('c1')
    expect(created.hotelId).toBe('h1')
    expect(created.stationId).toBe('st1')
  })

  it('rechaza categoría con estación de OTRO hotel (ValidationError)', async () => {
    const stations = makeRepo<StationDTO>({ findOne: async () => ({ id: 'st1', hotelId: 'OTRO', name: 'Bar' } as StationDTO) })
    await expect(svc({ stations }).createCategory({ name: 'X', stationId: 'st1' }, user)).rejects.toThrow('otro hotel')
  })

  it('NO borra una categoría con ítems (ConflictError 409)', async () => {
    const categories = makeRepo<CategoryDTO>({ findById: async () => ({ id: 'c1', hotelId: 'h1', name: 'Bebidas' } as CategoryDTO) })
    const items = makeRepo<MenuItemDTO>({ findMany: async () => [{ id: 'i1', categoryId: 'c1' } as MenuItemDTO] })
    await expect(svc({ categories, items }, strictAuth).deleteCategory('c1', user)).rejects.toThrow('ítems')
  })

  it('borra una categoría sin ítems', async () => {
    const categories = makeRepo<CategoryDTO>({ findById: async () => ({ id: 'c1', hotelId: 'h1', name: 'Vacía' } as CategoryDTO) })
    const items = makeRepo<MenuItemDTO>({ findMany: async () => [] })
    await expect(svc({ categories, items }, strictAuth).deleteCategory('c1', user)).resolves.toBeUndefined()
  })
})

describe('RestaurantService — carta: ítems (RES-1)', () => {
  const cat = makeRepo<CategoryDTO>({ findOne: async () => ({ id: 'c1', hotelId: 'h1', name: 'Platos' } as CategoryDTO) })

  it('crea ítem con precio neto y categoría válida del hotel', async () => {
    let created: any = null
    const items = makeRepo<MenuItemDTO>({ create: async (d: any) => { created = d; return { id: 'i1', ...d } } })
    const it = await svc({ categories: cat, items }).createItem({ categoryId: 'c1', name: 'Pizza', price: 10 }, user)
    expect(it.id).toBe('i1')
    expect(created.hotelId).toBe('h1')
    expect(created.price).toBe(10)
    expect(created.available).toBe(1)
  })

  it('rechaza categoría inexistente / de otro hotel', async () => {
    const badCat = makeRepo<CategoryDTO>({ findOne: async () => null })
    await expect(svc({ categories: badCat }).createItem({ categoryId: 'x', name: 'Y', price: 5 }, user)).rejects.toThrow()
  })

  it('rechaza precio negativo o NaN', async () => {
    await expect(svc({ categories: cat }).createItem({ categoryId: 'c1', name: 'Z', price: -1 }, user)).rejects.toThrow('precio')
    await expect(svc({ categories: cat }).createItem({ categoryId: 'c1', name: 'Z', price: NaN }, user)).rejects.toThrow('precio')
  })

  it('toggle de disponibilidad (86’) invierte el estado actual', async () => {
    const items = makeRepo<MenuItemDTO>({
      findById: async () => ({ id: 'i1', hotelId: 'h1', name: 'Pizza', available: 1 } as MenuItemDTO),
      update: async (id: any, d: any) => ({ id, hotelId: 'h1', name: 'Pizza', ...d } as MenuItemDTO),
    })
    const it = await svc({ items }, strictAuth).setItemAvailability('i1', undefined, user)
    expect(it.available).toBe(0)
  })
})

describe('RestaurantService — mesas (RES-2)', () => {
  it('crea mesa con status default free y forzando hotelId', async () => {
    let created: any = null
    const tables = makeRepo<TableDTO>({ create: async (d: any) => { created = d; return { id: 't1', ...d } } })
    const t = await svc({ tables }).createTable({ name: 'Mesa 4', capacity: 4 }, user)
    expect(t.id).toBe('t1')
    expect(created.hotelId).toBe('h1')
    expect(created.status).toBe('free')
  })

  it('rechaza un status de mesa inválido', async () => {
    await expect(svc().createTable({ name: 'Mesa 5', status: 'busy' as any }, user)).rejects.toThrow('inválido')
  })

  it('getTable respeta ownership (otro hotel = IDOR)', async () => {
    const tables = makeRepo<TableDTO>({ findById: async () => ({ id: 't1', hotelId: 'OTRO', name: 'Mesa 9' } as TableDTO) })
    await expect(svc({ tables }, strictAuth).getTable('t1', user)).rejects.toThrow('IDOR')
  })

  it('rechaza capacidad negativa', async () => {
    await expect(svc().createTable({ name: 'Mesa 6', capacity: -3 }, user)).rejects.toThrow('capacidad')
  })

  it('updateTable rechaza status inválido', async () => {
    const tables = makeRepo<TableDTO>({ findById: async () => ({ id: 't1', hotelId: 'h1', name: 'Mesa 1' } as TableDTO) })
    await expect(svc({ tables }, strictAuth).updateTable('t1', { status: 'busy' as any }, user)).rejects.toThrow('inválido')
  })

  it('deleteTable respeta ownership (otro hotel = IDOR)', async () => {
    const tables = makeRepo<TableDTO>({ findById: async () => ({ id: 't1', hotelId: 'OTRO', name: 'Mesa 9' } as TableDTO) })
    await expect(svc({ tables }, strictAuth).deleteTable('t1', user)).rejects.toThrow('IDOR')
  })
})

describe('RestaurantService — fixes de QA (stationId nulabilidad, availability, IDOR mutaciones)', () => {
  it('M2: crear categoría con stationId="" NO persiste referencia colgante (→ undefined)', async () => {
    let created: any = null
    const categories = makeRepo<CategoryDTO>({ create: async (d: any) => { created = d; return { id: 'c1', ...d } } })
    await svc({ categories }).createCategory({ name: 'Sin ruteo', stationId: '' }, user)
    expect(created.stationId).toBeUndefined()
  })

  it('M1: updateCategory con stationId="" des-rutea (guarda null)', async () => {
    let patched: any = null
    const categories = makeRepo<CategoryDTO>({
      findById: async () => ({ id: 'c1', hotelId: 'h1', name: 'Cócteles', stationId: 'st1' } as CategoryDTO),
      update: async (_id: any, d: any) => { patched = d; return { id: 'c1', hotelId: 'h1', name: 'Cócteles', ...d } as CategoryDTO },
    })
    await svc({ categories }, strictAuth).updateCategory('c1', { stationId: '' }, user)
    expect(patched.stationId).toBeNull()   // '' → null (des-ruteado), no queda la vieja
  })

  it('M1: updateItem con stationId="" des-rutea (guarda null)', async () => {
    let patched: any = null
    const items = makeRepo<MenuItemDTO>({
      findById: async () => ({ id: 'i1', hotelId: 'h1', name: 'Postre', stationId: 'st1' } as MenuItemDTO),
      update: async (_id: any, d: any) => { patched = d; return { id: 'i1', hotelId: 'h1', name: 'Postre', ...d } as MenuItemDTO },
    })
    await svc({ items }, strictAuth).updateItem('i1', { stationId: '' }, user)
    expect(patched.stationId).toBeNull()
  })

  it('B1: rechaza taxRate negativo en createItem', async () => {
    const cat = makeRepo<CategoryDTO>({ findOne: async () => ({ id: 'c1', hotelId: 'h1', name: 'X' } as CategoryDTO) })
    await expect(svc({ categories: cat }).createItem({ categoryId: 'c1', name: 'Y', price: 5, taxRate: -1 }, user)).rejects.toThrow('impuesto')
  })

  it('setAvailability con available=0 EXPLÍCITO apaga (no invierte)', async () => {
    let patched: any = null
    const items = makeRepo<MenuItemDTO>({
      findById: async () => ({ id: 'i1', hotelId: 'h1', name: 'Pizza', available: 0 } as MenuItemDTO),
      update: async (_id: any, d: any) => { patched = d; return { id: 'i1', hotelId: 'h1', ...d } as MenuItemDTO },
    })
    await svc({ items }, strictAuth).setItemAvailability('i1', 0, user)
    expect(patched.available).toBe(0)   // fija 0, no invierte a 1
  })

  it('IDOR en mutaciones: updateItem/deleteItem de otro hotel rechazados', async () => {
    const items = makeRepo<MenuItemDTO>({ findById: async () => ({ id: 'i1', hotelId: 'OTRO', name: 'Z' } as MenuItemDTO) })
    await expect(svc({ items }, strictAuth).updateItem('i1', { name: 'hack' }, user)).rejects.toThrow('IDOR')
    await expect(svc({ items }, strictAuth).deleteItem('i1', user)).rejects.toThrow('IDOR')
  })

  it('updateItem re-valida precio negativo', async () => {
    const items = makeRepo<MenuItemDTO>({ findById: async () => ({ id: 'i1', hotelId: 'h1', name: 'P' } as MenuItemDTO) })
    await expect(svc({ items }, strictAuth).updateItem('i1', { price: -9 }, user)).rejects.toThrow('precio')
  })
})

// ─── RES-3: comandas ───────────────────────────────────────────────────────
// Repo respaldado por un store en memoria: create/findMany/update/delete ven la MISMA tabla.
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

interface Repos3 extends Repos {
  orders?: RepositoryAdapter<OrderDTO>
  lines?: RepositoryAdapter<any>
  config?: RepositoryAdapter<any>
  hotels?: RepositoryAdapter<any>
}
function svc3(r: Repos3, auth: Auth = passAuth) {
  return new RestaurantService(
    r.stations ?? makeRepo<StationDTO>(),
    r.categories ?? makeRepo<CategoryDTO>(),
    r.items ?? makeRepo<MenuItemDTO>(),
    r.tables ?? makeRepo<TableDTO>(),
    makeUserRepo('h1'), log, auth,
    r.orders ?? makeRepo<OrderDTO>(),
    r.lines ?? makeRepo<any>(),
    r.config ?? makeRepo<any>(),
    r.hotels ?? makeRepo<any>(),
  )
}
// config con impuesto 18% para el hotel h1.
const taxConfig = () => makeRepo<any>({ findOne: async (q: any) => (q.key === 'taxes' ? { id: 'cfg', hotelId: 'h1', key: 'taxes', value: [{ active: true, rate: 18 }] } : null) })

describe('RestaurantService — comandas (RES-3)', () => {
  it('abre comanda dine_in: exige mesa, la ocupa y genera número', async () => {
    const tablesStore: any[] = []
    const tables = backed<TableDTO>(tablesStore, [{ id: 't1', hotelId: 'h1', name: 'Mesa 1', status: 'free' }])
    const orders = backed<OrderDTO>([])
    const o = await svc3({ tables, orders, config: taxConfig() }).openOrder({ type: 'dine_in', tableId: 't1' }, user)
    expect(o.status).toBe('open')
    expect(o.number).toMatch(/^CMD-\d{4}-\d{4}$/)
    expect(o.waiterId).toBe('u1')
    expect(tablesStore[0].status).toBe('occupied')
  })

  it('dine_in sin mesa → ValidationError', async () => {
    await expect(svc3({ config: taxConfig() }).openOrder({ type: 'dine_in' }, user)).rejects.toThrow('mesa')
  })

  it('dine_in sobre mesa con comanda abierta → ConflictError (una mesa, una comanda)', async () => {
    const tables = backed<TableDTO>([], [{ id: 't1', hotelId: 'h1', name: 'M1', status: 'occupied' }])
    const orders = backed<OrderDTO>([], [{ id: 'o1', hotelId: 'h1', tableId: 't1', status: 'open' }])
    await expect(svc3({ tables, orders, config: taxConfig() }).openOrder({ type: 'dine_in', tableId: 't1' }, user)).rejects.toThrow('ya tiene una comanda')
  })

  it('room_service sin reserva → ValidationError; takeaway sin nada → ok', async () => {
    await expect(svc3({ config: taxConfig() }).openOrder({ type: 'room_service' }, user)).rejects.toThrow('reserva')
    const o = await svc3({ orders: backed<OrderDTO>([]), config: taxConfig() }).openOrder({ type: 'takeaway' }, user)
    expect(o.type).toBe('takeaway')
  })

  it('addLine: snapshotea precio/nombre/taxRate, resuelve estación y recalcula totales', async () => {
    const ordersStore: any[] = [{ id: 'o1', hotelId: 'h1', status: 'open', tip: 0, subtotal: 0, tax: 0, total: 0 }]
    const linesStore: any[] = []
    const orders = backed<OrderDTO>(ordersStore)
    const lines = backed<any>(linesStore)
    const items = makeRepo<MenuItemDTO>({ findOne: async () => ({ id: 'm1', hotelId: 'h1', name: 'Pizza', price: 10, categoryId: 'c1', available: 1 } as MenuItemDTO) })
    const stations = makeRepo<StationDTO>({ findMany: async () => [{ id: 'st1', hotelId: 'h1', name: 'Cocina', active: 1, sortOrder: 0 } as StationDTO], findOne: async () => ({ id: 'st1', hotelId: 'h1', name: 'Cocina' } as StationDTO) })
    const categories = makeRepo<CategoryDTO>({ findOne: async () => ({ id: 'c1', hotelId: 'h1', name: 'Platos', stationId: 'st1' } as CategoryDTO) })
    const line = await svc3({ orders, lines, items, categories, stations, config: taxConfig(), hotels: makeRepo<any>() }, strictAuth).addLine('o1', { menuItemId: 'm1', quantity: 2 }, user)
    expect(line.name).toBe('Pizza')
    expect(line.unitPrice).toBe(10)
    expect(line.taxRate).toBe(18)          // tasa del hotel (config), snapshot
    expect(line.stationName).toBe('Cocina') // resuelta por categoría
    expect(line.lineTotal).toBe(20)
    expect(ordersStore[0].subtotal).toBe(20)
    expect(ordersStore[0].tax).toBe(3.6)    // 20 * 18%
    expect(ordersStore[0].total).toBe(23.6)
  })

  it('addLine rechaza ítem no disponible y cantidad < 1', async () => {
    const orders = backed<OrderDTO>([], [{ id: 'o1', hotelId: 'h1', status: 'open', tip: 0 }])
    const unavailable = makeRepo<MenuItemDTO>({ findOne: async () => ({ id: 'm1', hotelId: 'h1', name: 'Agotado', price: 5, available: 0 } as MenuItemDTO) })
    await expect(svc3({ orders, items: unavailable, config: taxConfig() }, strictAuth).addLine('o1', { menuItemId: 'm1' }, user)).rejects.toThrow('no está disponible')
    const ok = makeRepo<MenuItemDTO>({ findOne: async () => ({ id: 'm1', hotelId: 'h1', name: 'X', price: 5, available: 1 } as MenuItemDTO) })
    await expect(svc3({ orders, items: ok, config: taxConfig(), hotels: makeRepo<any>(), lines: backed<any>([]), stations: makeRepo<StationDTO>({ findMany: async () => [] }) }, strictAuth).addLine('o1', { menuItemId: 'm1', quantity: 0 }, user)).rejects.toThrow('cantidad')
  })

  it('addLine rechazado si la comanda está paid/charged/cancelled', async () => {
    const orders = backed<OrderDTO>([], [{ id: 'o1', hotelId: 'h1', status: 'paid', tip: 0 }])
    await expect(svc3({ orders, config: taxConfig() }, strictAuth).addLine('o1', { menuItemId: 'm1' }, user)).rejects.toThrow('no admite cambios')
  })

  it('sendOrder open→sent con líneas; vacía → ValidationError; emite onOrderSent', async () => {
    let sentEvt = false
    const orders = backed<OrderDTO>([], [{ id: 'o1', hotelId: 'h1', status: 'open', tip: 0 }])
    const emptyLines = backed<any>([])
    await expect(svc3({ orders, lines: emptyLines, config: taxConfig() }, strictAuth).sendOrder('o1', user)).rejects.toThrow('no tiene líneas')
    const lines = backed<any>([], [{ id: 'l1', hotelId: 'h1', orderId: 'o1', status: 'new' }])
    const s = svc3({ orders, lines, config: taxConfig() }, strictAuth)
    s.setSockets({ onOrderSent: async () => { sentEvt = true } })
    const o = await s.sendOrder('o1', user)
    expect(o.status).toBe('sent')
    expect(sentEvt).toBe(true)
  })

  it('cancelOrder libera la mesa; una comanda liquidada no se cancela', async () => {
    const tablesStore: any[] = [{ id: 't1', hotelId: 'h1', name: 'M1', status: 'occupied' }]
    const tables = backed<TableDTO>(tablesStore)
    const orders = backed<OrderDTO>([], [{ id: 'o1', hotelId: 'h1', tableId: 't1', status: 'served', tip: 0 }])
    await svc3({ orders, tables, config: taxConfig() }, strictAuth).cancelOrder('o1', user)
    expect(tablesStore[0].status).toBe('free')
    const paid = backed<OrderDTO>([], [{ id: 'o2', hotelId: 'h1', status: 'paid', tip: 0 }])
    await expect(svc3({ orders: paid, config: taxConfig() }, strictAuth).cancelOrder('o2', user)).rejects.toThrow('liquidada')
  })

  it('IDOR: getOrder de otro hotel es inaccesible', async () => {
    const orders = backed<OrderDTO>([], [{ id: 'o1', hotelId: 'OTRO', status: 'open' }])
    await expect(svc3({ orders }, strictAuth).getOrder('o1', user)).rejects.toThrow('IDOR')
  })

  it('updateLine recalcula los totales al cambiar la cantidad', async () => {
    const ordersStore: any[] = [{ id: 'o1', hotelId: 'h1', status: 'open', tip: 0, subtotal: 20, tax: 3.6, total: 23.6 }]
    const linesStore: any[] = [{ id: 'l1', hotelId: 'h1', orderId: 'o1', unitPrice: 10, quantity: 2, taxRate: 18, lineTotal: 20, status: 'new' }]
    await svc3({ orders: backed<OrderDTO>(ordersStore), lines: backed<any>(linesStore), config: taxConfig(), hotels: makeRepo<any>() }, strictAuth)
      .updateLine('o1', 'l1', { quantity: 3 }, user)
    expect(linesStore[0].lineTotal).toBe(30)
    expect(ordersStore[0].subtotal).toBe(30)
    expect(ordersStore[0].tax).toBe(5.4)
    expect(ordersStore[0].total).toBe(35.4)
  })

  it('removeLine baja los totales y excluye la línea', async () => {
    const ordersStore: any[] = [{ id: 'o1', hotelId: 'h1', status: 'open', tip: 0, subtotal: 30, tax: 5.4, total: 35.4 }]
    const linesStore: any[] = [
      { id: 'l1', hotelId: 'h1', orderId: 'o1', unitPrice: 10, quantity: 2, taxRate: 18, lineTotal: 20, status: 'new' },
      { id: 'l2', hotelId: 'h1', orderId: 'o1', unitPrice: 10, quantity: 1, taxRate: 18, lineTotal: 10, status: 'new' },
    ]
    await svc3({ orders: backed<OrderDTO>(ordersStore), lines: backed<any>(linesStore), config: taxConfig(), hotels: makeRepo<any>() }, strictAuth)
      .removeLine('o1', 'l2', user)
    expect(linesStore.find((l) => l.id === 'l2')).toBeUndefined()
    expect(ordersStore[0].subtotal).toBe(20)
    expect(ordersStore[0].total).toBe(23.6)
  })

  it('IDOR en mutaciones: addLine y cancelOrder de otro hotel rechazados', async () => {
    const foreign = () => backed<OrderDTO>([], [{ id: 'o1', hotelId: 'OTRO', status: 'open', tip: 0 }])
    await expect(svc3({ orders: foreign(), config: taxConfig(), hotels: makeRepo<any>() }, strictAuth).addLine('o1', { menuItemId: 'm1' }, user)).rejects.toThrow('IDOR')
    await expect(svc3({ orders: foreign(), config: taxConfig() }, strictAuth).cancelOrder('o1', user)).rejects.toThrow('IDOR')
  })
})
