// connectors/folios-accounting.ts — folios → contabilidad (CTB-4). SOLO cablea.
// El ingreso se devenga al postear un cargo al folio (night audit + cargos manuales), consistente
// con reports/money.ts. La lógica vive en accounting/usecases/auto-from-events.recordFolioCharge.
import type { ConnectorContext } from 'arckode-framework'
import { recordFolioCharge, type AccountingPort } from '../modules/accounting'

export function foliosAccountingConnector(ctx: ConnectorContext): void {
  const folios = ctx.resolveModule<{ setSockets: (s: any) => void }>('folios')
  const acc = () => ctx.resolveModule<AccountingPort>('accounting')

  folios.setSockets({
    onFolioCharged: (folio: any, charge: any) => recordFolioCharge(acc(), folio, charge),
  })
}
