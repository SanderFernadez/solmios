// inventario/tests/refund-revert.test.ts — Reembolso POS: reversión de inventario (INT-1 / tarea 6.4).
// Cubre la lógica de revertOrder a nivel servicio: siembra un `out` pos_sale, lista por source,
// dispara applyExternalMovement espejo (source='pos_refund', mismo sourceId). Valida creación + idempotencia.
// No instancia el conector (requiere ctx.resolveModule): el flujo del conector llama exactamente a esta
// cadena listMovementsBySource → applyExternalMovement, así que el test de servicio es representativo.
import { describe, it, expect } from 'bun:test'
import type { RepositoryAdapter, Auth } from 'arckode-framework'
import { silentLogger } from 'arckode-framework/testing'
import { InventarioService } from '../service'
import type { InventoryItemDTO, StockMovementDTO, CurrentUser } from '../types'

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

function svc(itemsStore: any[], movStore: any[]) {
  return new InventarioService(
    backed<InventoryItemDTO>(itemsStore), backed<StockMovementDTO>(movStore),
    makeUserRepo('h1'), log, passAuth,
  )
}

/**
 * Llama directa al método del service (mismo que invoca el conector). El conector solo filtra líneas y
 * delega acá, así que este test cubre la cadena completa de reversión: listMovementsBySource →
 * applyExternalMovement con source='pos_refund'.
 */
async function revertOrder(s: InventarioService, hotelId: string, lineIds: string[]): Promise<void> {
  await s.revertPosSale({ hotelId, lineIds }, sys)
}

describe('Reembolso POS — reversión de inventario (tarea 6.4)', () => {
  it('revierte un out pos_sale con un in pos_refund espejo (mismo sourceId + quantity + unitCost)', async () => {
    const items = [{ id: 'itemA', hotelId: 'h1', name: 'Tomate', currentStock: 95, avgCost: 10, unit: 'kg', minStock: 0 }]
    const movStore: any[] = [
      { id: 'mov1', hotelId: 'h1', itemId: 'itemA', type: 'out', quantity: 5, unitCost: 10,
        source: 'pos_sale', sourceId: 'line1:itemA', balanceAfter: 95 },
    ]
    const s = svc(items, movStore)

    await revertOrder(s, 'h1', ['line1'])

    const ins = movStore.filter((m) => m.source === 'pos_refund' && m.sourceId === 'line1:itemA')
    expect(ins.length).toBe(1)
    expect(ins[0].type).toBe('in')
    expect(ins[0].quantity).toBe(5)
    expect(ins[0].unitCost).toBe(10)
    expect(ins[0].reason).toBe('Reembolso POS')
    // El stock volvió a 100 (95 + 5); avgCost se mantiene (mismo costo).
    expect(items[0].currentStock).toBe(100)
    expect(items[0].avgCost).toBe(10)
  })

  it('idempotente: un segundo revertOrder del mismo order NO crea un segundo in', async () => {
    // Stock inicial 95 = el resultado de haber aplicado el out pos_sale (100 - 5).
    const items = [{ id: 'itemA', hotelId: 'h1', name: 'Tomate', currentStock: 95, avgCost: 10, unit: 'kg', minStock: 0 }]
    const movStore: any[] = [
      { id: 'mov1', hotelId: 'h1', itemId: 'itemA', type: 'out', quantity: 5, unitCost: 10,
        source: 'pos_sale', sourceId: 'line1:itemA', balanceAfter: 95 },
    ]
    const s = svc(items, movStore)

    await revertOrder(s, 'h1', ['line1'])
    await revertOrder(s, 'h1', ['line1'])   // reintento (p.ej. socket reentrante)

    const ins = movStore.filter((m) => m.source === 'pos_refund')
    expect(ins.length).toBe(1)
    // Stock vuelve a 100 una sola vez (95 + 5); el reintento NO suma otro 5 → no llega a 105.
    expect(items[0].currentStock).toBe(100)
  })

  it('reversa SOLO las líneas de la orden reembolsada (ignora outs de otras líneas)', async () => {
    const items = [{ id: 'itemA', hotelId: 'h1', name: 'Tomate', currentStock: 90, avgCost: 10, unit: 'kg', minStock: 0 }]
    const movStore: any[] = [
      { id: 'mov1', hotelId: 'h1', itemId: 'itemA', type: 'out', quantity: 5, unitCost: 10,
        source: 'pos_sale', sourceId: 'line1:itemA', balanceAfter: 95 },
      { id: 'mov2', hotelId: 'h1', itemId: 'itemA', type: 'out', quantity: 5, unitCost: 10,
        source: 'pos_sale', sourceId: 'lineOTHER:itemA', balanceAfter: 90 },
    ]
    const s = svc(items, movStore)

    // Reembolsa solo la línea line1 (no lineOTHER).
    await revertOrder(s, 'h1', ['line1'])

    const ins = movStore.filter((m) => m.source === 'pos_refund')
    expect(ins.length).toBe(1)
    expect(ins[0].sourceId).toBe('line1:itemA')
  })

  it('sin outs pos_sale para la orden → no crea ningún in y no rompe', async () => {
    const items = [{ id: 'itemA', hotelId: 'h1', name: 'Tomate', currentStock: 100, avgCost: 10, unit: 'kg', minStock: 0 }]
    const movStore: any[] = []
    const s = svc(items, movStore)

    await revertOrder(s, 'h1', ['line1'])

    expect(movStore.filter((m) => m.source === 'pos_refund').length).toBe(0)
    expect(items[0].currentStock).toBe(100)
  })
})
