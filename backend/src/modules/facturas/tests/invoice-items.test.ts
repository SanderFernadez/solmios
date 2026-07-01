// facturas/tests/invoice-items.test.ts — Tests de los usecases de líneas de factura.
import { describe, it, expect } from 'bun:test'
import type { RepositoryAdapter } from 'arckode-framework'
import { assertItemsSum, attachItems, deleteItems } from '../usecases/invoice-items'
import type { FacturasDTO } from '../types'

const repoWith = (rows: any[], deleted: { c: number }): RepositoryAdapter<any> => ({
  findMany: async () => rows,
  create: async (d: any) => ({ id: 'item-new', ...d }),
  delete: async () => { deleted.c++; return true },
  findById: async () => null, findOne: async () => null,
  update: async () => null, count: async () => 0,
  paginate: async () => ({ data: [], total: 0, limit: 20, offset: 0, pages: 0, hasNext: false, hasPrev: false }),
} as any)

describe('assertItemsSum', () => {
  it('pasa cuando la suma coincide con el monto base', () => {
    expect(() => assertItemsSum([{ description: 'A', amount: 50 }, { description: 'B', amount: 50 }], 100)).not.toThrow()
  })
  it('pasa con tolerancia de redondeo (< 1)', () => {
    expect(() => assertItemsSum([{ description: 'A', amount: 33.33 }, { description: 'B', amount: 33.33 }], 66.66)).not.toThrow()
  })
  it('lanza Error cuando la suma diverge del monto', () => {
    expect(() => assertItemsSum([{ description: 'A', amount: 50 }], 100)).toThrow('Inconsistencia financiera')
  })
})

describe('attachItems', () => {
  it('adjunta los items persistidos al DTO', async () => {
    const repo = repoWith([{ id: 'i1', description: 'Minibar', amount: 120, quantity: 1, unitPrice: 120 }], { c: 0 })
    const result = await attachItems(repo, { id: 'inv1', hotelId: 'h1' } as FacturasDTO)
    expect(result.items).toHaveLength(1)
    expect(result.items![0].description).toBe('Minibar')
    expect(result.items![0].amount).toBe(120)
  })
  it('devuelve la factura intacta si no hay items en tabla', async () => {
    const repo = repoWith([], { c: 0 })
    const result = await attachItems(repo, { id: 'inv1', hotelId: 'h1' } as FacturasDTO)
    expect(result.items).toBeUndefined()
  })
})

describe('deleteItems', () => {
  it('borra todos los items de la factura (cascade manual)', async () => {
    const deleted = { c: 0 }
    const repo = repoWith([{ id: 'i1' }, { id: 'i2' }], deleted)
    await deleteItems(repo, 'inv1')
    expect(deleted.c).toBe(2)
  })
  it('no falla si la factura no tiene items', async () => {
    const deleted = { c: 0 }
    const repo = repoWith([], deleted)
    await deleteItems(repo, 'inv1')
    expect(deleted.c).toBe(0)
  })
})
