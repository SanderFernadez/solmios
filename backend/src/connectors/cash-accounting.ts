// connectors/cash-accounting.ts — cash → contabilidad (DT-15). SOLO cablea.
// La lógica (faltante = gasto, sobrante = ingreso) vive en accounting/usecases/auto-from-events.recordCashDifference.
import type { ConnectorContext } from 'arckode-framework'
import { recordCashDifference, type AccountingPort } from '../modules/accounting'

export function cashAccountingConnector(ctx: ConnectorContext): void {
  const caja = ctx.resolveModule<{ setSockets: (s: any) => void }>('caja')
  const acc = () => ctx.resolveModule<AccountingPort>('accounting')

  caja.setSockets({
    onShiftClosed: (shift: any) => recordCashDifference(acc(), shift),
  })
}
