// connectors/facturas-accounting.ts — facturas → contabilidad (CTB-4.2 / DT-12). SOLO cablea.
// Devenga el ingreso de una factura STANDALONE (sin folio) al crearse. Una factura emitida desde
// el cierre de un folio (`folioId` seteado) YA devengó vía `folios-accounting` al postear el cargo
// — este conector se auto-excluye (`recordInvoiceIssued` chequea `invoice.folioId`) para no doblar.
import type { ConnectorContext } from 'arckode-framework'
import { recordInvoiceIssued, type AccountingPort } from '../modules/accounting'

export function facturasAccountingConnector(ctx: ConnectorContext): void {
  const facturas = ctx.resolveModule<{ setSockets: (s: any) => void }>('facturas')
  const acc = () => ctx.resolveModule<AccountingPort>('accounting')

  facturas.setSockets({
    onFacturasCreated: (invoice: any) => recordInvoiceIssued(acc(), invoice),
  })
}
