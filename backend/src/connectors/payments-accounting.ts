// connectors/payments-accounting.ts — payments → contabilidad (CTB-4). SOLO cablea:
// toda la lógica evento→asiento vive en accounting/usecases/auto-from-events.
import type { ConnectorContext } from 'arckode-framework'
import { recordPaymentCompleted, recordRefund, recordDeposit, recordDepositRelease, type AccountingPort } from '../modules/accounting'

export function paymentsAccountingConnector(ctx: ConnectorContext): void {
  const payments = ctx.resolveModule<{ setSockets: (s: any) => void }>('payments')
  const acc = () => ctx.resolveModule<AccountingPort>('accounting')

  payments.setSockets({
    onPaymentCompleted: (p: any) => recordPaymentCompleted(acc(), p),
    onRefundProcessed: (p: any) => recordRefund(acc(), p),
    // DT-08 (mínimo viable): depósito de garantía = pasivo (DR Bancos / CR Depósitos de
    // Huéspedes), NUNCA un ingreso — por eso usa su propio asiento (recordDeposit/recordDepositRelease),
    // no recordPaymentCompleted. onDepositRefunded reusa el mismo asiento de liberación: contablemente
    // es la misma naturaleza de movimiento (sale de Depósitos de Huéspedes hacia el huésped), sea
    // reembolso parcial o liberación completa del hold.
    onDepositCreated: (d: any) => recordDeposit(acc(), d),
    onDepositReleased: (d: any) => recordDepositRelease(acc(), d),
    onDepositRefunded: (d: any) => recordDepositRelease(acc(), d),
  })
}
