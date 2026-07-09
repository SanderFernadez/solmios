// connectors/payroll-gastos.ts — Conector payroll→gastos.
// Pagar la nómina asienta el costo laboral como un gasto del hotel, y de ahí llega al balance y
// —si se pagó en efectivo— a la caja. La lógica vive en shared/usecases/post-payroll-expense.
//
// Best-effort: si gastos no resuelve, no falla el pago de la nómina. La fuente de verdad del pago es
// el propio run.

import type { ConnectorContext } from 'arckode-framework'
import type { PayrollRunDTO } from '../modules/payroll'
import { postPayrollExpense, type GastosPort } from '../shared/usecases/post-payroll-expense'

export function payrollGastosConnector(ctx: ConnectorContext): void {
  const payroll = ctx.resolveModule<{ setSockets: (s: any) => void }>('payroll')

  payroll.setSockets({
    onRunPaid: async (run: PayrollRunDTO) => {
      try {
        await postPayrollExpense(ctx.resolveModule<GastosPort>('gastos'), run)
      } catch {
        // Conector best-effort: no falla el módulo principal si gastos no resuelve.
      }
    },
  })
}
