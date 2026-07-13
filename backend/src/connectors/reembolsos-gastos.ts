// connectors/reembolsos-gastos.ts — Conector reembolsos→gastos.
// Pagar un reembolso saca plata del hotel; se asienta como gasto y de ahí, si fue en efectivo, cae
// en la caja vía `gastos-caja`. Sin esto, un reembolso en efectivo no aparecía en el arqueo del turno.
//
// Best-effort: si gastos no resuelve, no falla el pago del reembolso. La fuente de verdad es la
// tabla expense_claims.

import type { ConnectorContext } from 'arckode-framework'
import type { ExpenseClaimDTO } from '../modules/reembolsos'
import { postReimbursementExpense, type GastosPort } from '../shared/usecases/post-reimbursement-expense'

export function reembolsosGastosConnector(ctx: ConnectorContext): void {
  const reembolsos = ctx.resolveModule<{ setSockets: (s: any) => void }>('reembolsos')

  reembolsos.setSockets({
    onClaimPaid: async (claim: ExpenseClaimDTO) => {
      try {
        await postReimbursementExpense(ctx.resolveModule<GastosPort>('gastos'), claim)
      } catch {
        // Conector best-effort: no falla el módulo principal si gastos no resuelve.
      }
    },
  })
}
