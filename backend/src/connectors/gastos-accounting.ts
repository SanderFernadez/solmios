// connectors/gastos-accounting.ts — gastos → contabilidad (CTB-4). SOLO cablea.
// La lógica (gasto pagado vs a crédito → cuenta) vive en accounting/usecases/auto-from-events.recordExpense.
import type { ConnectorContext } from 'arckode-framework'
import { recordExpense, type AccountingPort } from '../modules/accounting'

export function gastosAccountingConnector(ctx: ConnectorContext): void {
  const gastos = ctx.resolveModule<{ setSockets: (s: any) => void }>('gastos')
  const acc = () => ctx.resolveModule<AccountingPort>('accounting')

  gastos.setSockets({
    onGastosCreated: (e: any) => recordExpense(acc(), e),
  })
}
