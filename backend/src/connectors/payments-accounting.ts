// connectors/payments-accounting.ts — payments → contabilidad (CTB-4). SOLO cablea:
// toda la lógica evento→asiento vive en accounting/usecases/auto-from-events.
import type { ConnectorContext } from 'arckode-framework'
import { recordPaymentCompleted, recordRefund, type AccountingPort } from '../modules/accounting'

export function paymentsAccountingConnector(ctx: ConnectorContext): void {
  const payments = ctx.resolveModule<{ setSockets: (s: any) => void }>('payments')
  const acc = () => ctx.resolveModule<AccountingPort>('accounting')

  payments.setSockets({
    onPaymentCompleted: (p: any) => recordPaymentCompleted(acc(), p),
    onRefundProcessed: (p: any) => recordRefund(acc(), p),
    // DEPÓSITOS: intencionalmente NO cableados. Hoy un depósito NO mueve plata real
    // (stripePaymentId='', deuda "Depósitos = ledger desconectado"): asentarlo bookearía dinero
    // fantasma. Las funciones recordDeposit/recordDepositRelease existen y están listas para cuando
    // los depósitos se integren con `payments` reales — recién ahí se cablean acá + se emiten los eventos.
  })
}
