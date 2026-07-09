// shared/tests/post-payroll-expense.test.ts — El costo laboral entra al sistema de dinero.
//
// Regresión: `markAsPaid` solo cambiaba un estado. Pagar la nómina no dejaba rastro en `expenses`,
// `payments` ni `cash_movements`, así que el balance ignoraba el mayor egreso de un hotel.

import { describe, it, expect } from 'bun:test'
import { postPayrollExpense, PAYROLL_EXPENSE_SOURCE, type GastosPort } from '../usecases/post-payroll-expense'
import type { PayrollRunDTO } from '../../modules/payroll'

const run = (over: Partial<PayrollRunDTO> = {}): PayrollRunDTO => ({
  id: 'run1', hotelId: 'h1', period: '2026-07',
  startDate: '2026-07-01', endDate: '2026-07-31', paymentDate: '2026-07-31',
  status: 'paid', totalGross: 10000, totalDeductions: 1600, totalNet: 8400,
  employeeCount: 6, approvedBy: 'u1', approvedAt: '', paidAt: '2026-07-31T12:00:00Z',
  paymentMethod: 'transfer',
  ...over,
})

function makePort(existing: any = null) {
  const created: any[] = []
  const port: GastosPort = {
    findBySource: async () => existing,
    create: async (dto: any) => { created.push(dto); return { id: 'e1', ...dto } },
  }
  return { port, created }
}

describe('postPayrollExpense', () => {
  it('asienta el gasto con categoría staff y ya pagado', async () => {
    const { port, created } = makePort()

    await postPayrollExpense(port, run())

    expect(created).toHaveLength(1)
    expect(created[0]).toMatchObject({
      hotelId: 'h1', category: 'staff', concept: 'Nómina 2026-07',
      paid: 1, source: PAYROLL_EXPENSE_SOURCE, sourceId: 'run1',
    })
  })

  // Lo que sale hoy es lo que cobran los empleados. Las retenciones se remiten después.
  it('el monto es el neto, no el bruto', async () => {
    const { port, created } = makePort()

    await postPayrollExpense(port, run({ totalGross: 10000, totalNet: 8400 }))

    expect(created[0].amount).toBe(8400)
  })

  it('arrastra el método de pago del run, para que la caja sepa si mover el cajón', async () => {
    const { port, created } = makePort()

    await postPayrollExpense(port, run({ paymentMethod: 'cash' }))

    expect(created[0].paymentMethod).toBe('cash')
  })

  it('sin método explícito asume transferencia, que no toca el cajón', async () => {
    const { port, created } = makePort()

    await postPayrollExpense(port, run({ paymentMethod: undefined }))

    expect(created[0].paymentMethod).toBe('transfer')
  })

  it('es idempotente: un run ya asentado no vuelve a crear el gasto', async () => {
    const { port, created } = makePort({ id: 'e-existente' })

    expect(await postPayrollExpense(port, run())).toBeNull()
    expect(created).toHaveLength(0)
  })

  it('una nómina de monto cero no genera gasto', async () => {
    const { port, created } = makePort()

    expect(await postPayrollExpense(port, run({ totalNet: 0 }))).toBeNull()
    expect(created).toHaveLength(0)
  })

  it('imputa el gasto a la fecha en que se pagó', async () => {
    const { port, created } = makePort()

    await postPayrollExpense(port, run({ paidAt: '2026-08-05T10:00:00Z', paymentDate: '2026-07-31' }))

    expect(created[0].date).toBe('2026-08-05')
  })

  it('deja el bruto y las deducciones en las notas, para poder auditarlo', async () => {
    const { port, created } = makePort()

    await postPayrollExpense(port, run())

    expect(created[0].notes).toContain('6 empleados')
    expect(created[0].notes).toContain('bruto 10000')
    expect(created[0].notes).toContain('deducciones 1600')
  })
})
