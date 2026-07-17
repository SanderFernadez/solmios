import { describe, it, expect } from 'bun:test'
import { silentLogger } from 'arckode-framework/testing'
import { payInvoice } from '../usecases/pay-invoice'
import type { PaymentPort, RecordPaymentInput } from '../usecases/payment-port'

const log = silentLogger()

const baseInvoice = {
  id: 'inv1', amount: 100, amountPaid: 0, hotelId: 'h1', guestId: 'g1',
  currency: 'USD', invoiceNumber: 'F-001', notes: '', status: 'pending',
}

function makePort(calls: RecordPaymentInput[]): PaymentPort {
  return {
    recordPayment: async (input) => {
      calls.push(input)
      return { id: `pay-${calls.length}`, status: 'completed' }
    },
  }
}

describe('payInvoice — payment real en payments (BM-1.5 / BM-1.6)', () => {
  it('BM-1.5: cobro en efectivo registra el pago en payments con method cash (→ caja) y marca paid', async () => {
    const calls: RecordPaymentInput[] = []
    const repo = { update: async (_id: string, patch: any) => ({ ...baseInvoice, ...patch }) }
    const result = await payInvoice(repo as any, log, makePort(calls), baseInvoice as any, { amount: 100, method: 'efectivo' })

    // El asiento del dinero: una sola fila en payments, method normalizado a 'cash'
    // (si no se normalizara, un efectivo caería en 'other' y se saltearía el turno de caja).
    expect(calls).toHaveLength(1)
    expect(calls[0].method).toBe('cash')
    expect(calls[0].amount).toBe(100)
    expect(calls[0].invoiceId).toBe('inv1')
    expect(calls[0].hotelId).toBe('h1')

    expect(result.status).toBe('paid')
    expect(result.paymentId).toBe('pay-1')
  })

  it('BM-1.6: dos cobros con métodos distintos → dos filas en payments y ningún método pisado', async () => {
    const calls: RecordPaymentInput[] = []
    let invoice = { ...baseInvoice }
    const repo = {
      update: async (_id: string, patch: any) => { invoice = { ...invoice, ...patch }; return invoice },
    }
    // Primer cobro: efectivo 60. Segundo: tarjeta 40. Antes, el segundo pisaba el método del primero.
    await payInvoice(repo as any, log, makePort(calls), invoice as any, { amount: 60, method: 'efectivo' })
    await payInvoice(repo as any, log, makePort(calls), invoice as any, { amount: 40, method: 'tarjeta' })

    expect(calls).toHaveLength(2)
    expect(calls[0].method).toBe('cash')
    expect(calls[1].method).toBe('card')
    expect(calls.map((c) => c.amount)).toEqual([60, 40])
    // amountPaid acumula (no se sobrescribe) y cubre el total → paid.
    expect(invoice.amountPaid).toBe(100)
    expect(invoice.status).toBe('paid')
  })

  it('pago parcial deja la factura pending y solo asienta lo cobrado', async () => {
    const calls: RecordPaymentInput[] = []
    const repo = { update: async (_id: string, patch: any) => ({ ...baseInvoice, ...patch }) }
    const result = await payInvoice(repo as any, log, makePort(calls), baseInvoice as any, { amount: 30, method: 'cash' })
    expect(calls[0].amount).toBe(30)
    expect(result.status).toBe('pending')
    expect(result.balance).toBe(70)
  })

  it('rechaza un sobrepago (monto mayor que el saldo): no se asienta nada', async () => {
    const calls: RecordPaymentInput[] = []
    const repo = { update: async (_id: string, patch: any) => ({ ...baseInvoice, ...patch }) }
    // Factura de 100, cobrar 150 → excede el saldo; el excedente no debe吸收se en payments.
    await expect(
      payInvoice(repo as any, log, makePort(calls), { ...baseInvoice, amount: 100 } as any, { amount: 150, method: 'cash' }),
    ).rejects.toThrow(/excede el saldo/)
    expect(calls).toHaveLength(0) // no se registra ningún pago
  })
})
