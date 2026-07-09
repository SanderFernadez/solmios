// facturas/tests/deletable.test.ts — Regla contable de borrado.
// Una factura con efectos contables se anula con nota de crédito, no se borra.

import { describe, it, expect } from 'bun:test'
import { assertDeletable } from '../usecases/deletable'
import type { FacturasDTO } from '../types'

function invoice(over: Partial<FacturasDTO> = {}): FacturasDTO {
  return {
    id: 'i1', hotelId: 'h1', invoiceNumber: 'INV-2026-0001', type: 'invoice', amount: 100,
    taxes: 0, currency: 'USD', status: 'pending', issueDate: '2026-07-08',
    createdAt: '', updatedAt: '',
    ...over,
  } as FacturasDTO
}

describe('assertDeletable', () => {
  it('permite borrar una factura recién creada, sin cobros', () => {
    expect(() => assertDeletable(invoice(), false)).not.toThrow()
  })

  it('bloquea una factura cobrada', () => {
    expect(() => assertDeletable(invoice({ status: 'paid' }), false)).toThrow(/nota de crédito/)
  })

  it('bloquea una factura vencida', () => {
    expect(() => assertDeletable(invoice({ status: 'overdue' }), false)).toThrow(/nota de crédito/)
  })

  it('bloquea una factura ya anulada', () => {
    expect(() => assertDeletable(invoice({ status: 'cancelled' }), false)).toThrow(/nota de crédito/)
  })

  it('bloquea una factura pending con un pago parcial aplicado', () => {
    expect(() => assertDeletable(invoice({ status: 'pending', amountPaid: 30 }), false)).toThrow(/pagos aplicados/)
  })

  it('bloquea cualquier factura si el hotel emite comprobantes fiscales', () => {
    expect(() => assertDeletable(invoice({ status: 'pending' }), true)).toThrow(/comprobante fiscal/)
  })

  it('deja borrar comprobantes de pago y cargos de folio: no son documentos fiscales', () => {
    expect(() => assertDeletable(invoice({ type: 'payment', status: 'paid' }), true)).not.toThrow()
    expect(() => assertDeletable(invoice({ type: 'folio' }), true)).not.toThrow()
  })
})
