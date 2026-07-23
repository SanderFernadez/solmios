// compras/tests/service.test.ts — Tests del servicio de compras (COM-1/2/3/4).
// Repos mock con estado. Puertos (stock/gasto/proveedor) mockeados.
import { describe, it, expect } from 'bun:test'
import type { RepositoryAdapter, Auth } from 'arckode-framework'
import { silentLogger } from 'arckode-framework/testing'
import { ComprasService } from '../service'
import type { ComprasPorts, CurrentUser } from '../types'

const log = silentLogger()
const passAuth: Auth = { assertOwnership: () => {}, authenticate: (() => []) as any } as unknown as Auth
const strictAuth: Auth = {
  assertOwnership: (rh: string, uh: string, role?: string, sa?: string) => { if (role === sa) return; if (rh !== uh) throw new Error('IDOR') },
  authenticate: (() => []) as any,
} as unknown as Auth
const user: CurrentUser = { id: 'u1', hotelId: 'h1', role: 'hotel_admin' }

function makeRepo<T extends object>(o: Partial<RepositoryAdapter<T>> = {}): RepositoryAdapter<T> {
  return {
    findMany: async () => [], findById: async () => null, findOne: async () => null,
    create: async (d: any) => ({ id: 'g', ...d }), update: async (id: any, d: any) => ({ id, ...d }),
    delete: async () => true, count: async () => 0,
    paginate: async () => ({ data: [], total: 0, limit: 100, offset: 0, pages: 0 }), ...o,
  } as RepositoryAdapter<T>
}
function backed<T extends object>(store: any[], seed: any[] = []): RepositoryAdapter<T> {
  store.push(...seed)
  const match = (r: any, q: any) => Object.keys(q || {}).every((k) => r[k] === q[k])
  let n = 0
  return {
    ...makeRepo<any>(),
    create: async (d: any) => { const row = { id: `x${++n}`, ...d }; store.push(row); return row },
    findById: async (id: any) => store.find((r) => r.id === id) ?? null,
    findOne: async (q: any) => store.find((r) => match(r, q)) ?? null,
    findMany: async (q: any = {}) => store.filter((r) => match(r, q)),
    update: async (id: any, d: any) => { const r = store.find((x) => x.id === id); if (r) Object.assign(r, d); return r ?? null },
    delete: async (id: any) => { const i = store.findIndex((x) => x.id === id); if (i >= 0) { store.splice(i, 1); return true } return false },
  } as RepositoryAdapter<T>
}
function userRepo(hotelId = 'h1') { return { ...makeRepo<any>(), findById: async () => ({ id: 'u1', hotelId }) } }

interface St { req?: any[]; reqI?: any[]; ord?: any[]; ordI?: any[]; rec?: any[]; recI?: any[]; hotels?: any[] }
function svc(s: St = {}, ports: ComprasPorts = {}, auth: Auth = passAuth, uh = 'h1') {
  const svc = new ComprasService(
    backed(s.req ?? []), backed(s.reqI ?? []), backed(s.ord ?? []), backed(s.ordI ?? []),
    backed(s.rec ?? []), backed(s.recI ?? []), backed([]), backed(s.hotels ?? [{ id: 'h1', currency: 'DOP', taxRate: 18 }]),
    userRepo(uh), log, auth,
  )
  svc.setPorts(ports)
  return svc
}

describe('ComprasService — requisiciones (COM-1)', () => {
  it('crea requisición con líneas + número REQ', async () => {
    const r = await svc().createRequisition({ notes: 'cocina', items: [{ description: 'Tomate', quantity: 5, inventoryItemId: 'i1' }] }, user)
    expect(r.hotelId).toBe('h1')
    expect(r.status).toBe('draft')
    expect(r.number).toMatch(/^REQ-/)
    expect(r.items.length).toBe(1)
  })
  it('ciclo draft→submitted→approved; transición inválida rechazada', async () => {
    const req: any[] = [], reqI: any[] = []
    const s = svc({ req, reqI })
    const r = await s.createRequisition({ items: [{ description: 'Ron', quantity: 2 }] }, user)
    await s.transitionRequisition(r.id, 'submitted', user)
    expect(req[0].status).toBe('submitted')
    await s.transitionRequisition(r.id, 'approved', user)
    expect(req[0].status).toBe('approved')
    expect(req[0].approvedBy).toBe('u1')
    await expect(s.transitionRequisition(r.id, 'submitted', user)).rejects.toThrow('inválida')
  })
  it('submit sin líneas se rechaza', async () => {
    const s = svc()
    const r = await s.createRequisition({ items: [] }, user)
    await expect(s.transitionRequisition(r.id, 'submitted', user)).rejects.toThrow()
  })
})

describe('ComprasService — órdenes de compra (COM-2)', () => {
  it('crea OC directa y calcula totales con impuesto de config (18%)', async () => {
    const o = await svc().createOrder({ supplierId: 's1', items: [
      { description: 'Ron', quantity: 10, unitPrice: 5 },   // 50
      { description: 'Coca', quantity: 4, unitPrice: 2.5 },  // 10
    ] }, user)
    expect(o.subtotal).toBe(60)
    expect(o.tax).toBe(10.8)    // 60 * 18%
    expect(o.total).toBe(70.8)
    expect(o.currency).toBe('DOP')
  })
  it('proveedor inexistente rechazado (puerto)', async () => {
    const s = svc({}, { supplierExists: async () => false })
    await expect(s.createOrder({ supplierId: 'zzz', items: [{ description: 'x', quantity: 1, unitPrice: 1 }] }, user)).rejects.toThrow('proveedor')
  })
  it('enviar OC sin líneas se rechaza', async () => {
    const s = svc()
    const o = await s.createOrder({ items: [] }, user)
    await expect(s.transitionOrder(o.id, 'sent', user)).rejects.toThrow()
  })
})

describe('ComprasService — recepción + facturación (COM-3/4)', () => {
  async function sentOrder(ports: ComprasPorts = {}) {
    const ord: any[] = [], ordI: any[] = [], rec: any[] = [], recI: any[] = []
    const s = svc({ ord, ordI, rec, recI }, ports)
    const o = await s.createOrder({ supplierId: 's1', items: [{ description: 'Ron', quantity: 10, unitPrice: 5, inventoryItemId: 'inv1' }] }, user)
    await s.transitionOrder(o.id, 'sent', user)
    return { s, o, ord, ordI, rec, recI }
  }

  it('recepción parcial suma receivedQty + llama addStock con sourceId; total → OC received', async () => {
    const added: any[] = []
    const { s, o, ord, ordI } = await sentOrder({ addStock: async (i) => { added.push(i) } })
    const lineId = ordI[0].id
    // parcial: 4 de 10
    await s.receive(o.id, { lines: [{ orderItemId: lineId, quantity: 4 }] }, user)
    expect(ordI[0].receivedQty).toBe(4)
    expect(ord[0].status).toBe('sent')   // aún no completo
    expect(added[0].itemId).toBe('inv1')
    expect(added[0].quantity).toBe(4)
    expect(added[0].sourceId).toBeTruthy()
    // completa: 6 restantes
    await s.receive(o.id, { lines: [{ orderItemId: lineId, quantity: 6 }] }, user)
    expect(ordI[0].receivedQty).toBe(10)
    expect(ord[0].status).toBe('received')
  })

  it('recibir más de lo pendiente se rechaza', async () => {
    const { s, o, ordI } = await sentOrder()
    await expect(s.receive(o.id, { lines: [{ orderItemId: ordI[0].id, quantity: 11 }] }, user)).rejects.toThrow('pendiente')
  })

  it('facturar genera UN gasto (puerto) y setea expenseId; segunda vez NO duplica', async () => {
    let calls = 0
    const { s, o, ord } = await sentOrder({ createExpenseFromPO: async () => { calls++; return { expenseId: 'exp1' } } })
    // recibir todo para llegar a received
    const ordItems = await s.getOrder(o.id, user)
    await s.receive(o.id, { lines: [{ orderItemId: ordItems.items[0].id, quantity: 10 }] }, user)
    const inv1 = await s.markInvoiced(o.id, { invoiceNumber: 'F-001' }, user)
    expect(inv1.expenseId).toBe('exp1')
    expect(calls).toBe(1)
    // segunda factura → dedup, no llama de nuevo
    await s.markInvoiced(o.id, { invoiceNumber: 'F-001' }, user)
    expect(calls).toBe(1)
  })

  it('IDOR: recibir contra una OC de otro hotel es inaccesible', async () => {
    const ord = [{ id: 'o1', hotelId: 'OTRO', status: 'sent' }]
    const s = svc({ ord }, {}, strictAuth)
    await expect(s.receive('o1', { lines: [{ orderItemId: 'x', quantity: 1 }] }, user)).rejects.toThrow('IDOR')
  })
})
