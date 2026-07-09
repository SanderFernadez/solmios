// shared/usecases/post-payroll-expense.ts — Asienta el pago de una nómina como gasto del hotel.
//
// Pagar una nómina saca plata. Hasta ahora `markAsPaid` solo cambiaba un estado: el costo laboral
// —normalmente el egreso más grande de un hotel— no existía para el balance, ni para los reportes,
// ni para el arqueo de caja.
//
// El egreso se asienta como un `expense` de categoría `staff`. Desde ahí cae solo en el balance y,
// si la nómina se pagó en efectivo, en la caja vía `gastos-caja`. Un solo asiento, un solo camino.

import type { PayrollRunDTO } from '../../modules/payroll'
import type { GastosDTO } from '../../modules/gastos'

export const PAYROLL_EXPENSE_SOURCE = 'payroll'

export interface GastosPort {
  findBySource(hotelId: string, source: string, sourceId: string): Promise<GastosDTO | null>
  create(dto: Record<string, unknown>, user: { id: string; role: string; hotelId: string }): Promise<GastosDTO>
}

/**
 * Idempotente por `sourceId = runId`. `payroll.cancel()` rechaza anular un run pagado, así que el
 * gasto no necesita reversión: una vez que la plata salió, salió.
 *
 * Monto = `totalNet`, NO `totalGross`: lo que sale hoy es lo que cobran los empleados. Las
 * retenciones se remiten después y son su propio gasto cuando se pagan.
 */
export async function postPayrollExpense(gastos: GastosPort, run: PayrollRunDTO): Promise<GastosDTO | null> {
  const amount = Number(run.totalNet || 0)
  if (amount <= 0) return null

  const existing = await gastos.findBySource(run.hotelId, PAYROLL_EXPENSE_SOURCE, run.id)
  if (existing) return null

  return gastos.create(
    {
      hotelId: run.hotelId,
      category: 'staff',
      concept: `Nómina ${run.period}`,
      amount,
      date: (run.paidAt || run.paymentDate || '').slice(0, 10),
      notes: `${run.employeeCount} empleados · bruto ${run.totalGross} · deducciones ${run.totalDeductions}`,
      paid: 1,
      paymentMethod: run.paymentMethod || 'transfer',
      source: PAYROLL_EXPENSE_SOURCE,
      sourceId: run.id,
    },
    // El pago lo dispara una persona, pero el asiento lo hace el sistema: el hotel sale del run.
    { id: 'system', role: 'super_admin', hotelId: run.hotelId },
  )
}
