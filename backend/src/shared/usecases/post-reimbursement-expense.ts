// shared/usecases/post-reimbursement-expense.ts — Asienta un reembolso pagado como gasto del hotel.
//
// Reintegrarle un gasto a un empleado saca plata del hotel. Igual que la nómina, se asienta como un
// `expense` de categoría `staff`; desde ahí cae solo en el balance y —si se pagó en efectivo— en la
// caja vía `gastos-caja`. Un solo asiento, un solo camino.

import type { GastosDTO } from '../../modules/gastos'
import type { ExpenseClaimDTO } from '../../modules/reembolsos'

export const REIMBURSEMENT_EXPENSE_SOURCE = 'reimbursement'

export interface GastosPort {
  findBySource(hotelId: string, source: string, sourceId: string): Promise<GastosDTO | null>
  create(dto: Record<string, unknown>, user: { id: string; role: string; hotelId: string }): Promise<GastosDTO>
}

/** Idempotente por `sourceId = claim.id`. Un reembolso pagado no se elimina (regla del módulo). */
export async function postReimbursementExpense(gastos: GastosPort, claim: ExpenseClaimDTO): Promise<GastosDTO | null> {
  const amount = Number(claim.amount || 0)
  if (amount <= 0) return null

  const existing = await gastos.findBySource(claim.hotelId, REIMBURSEMENT_EXPENSE_SOURCE, claim.id)
  if (existing) return null

  return gastos.create(
    {
      hotelId: claim.hotelId,
      category: 'staff',
      concept: `Reembolso: ${claim.description}`,
      amount,
      date: (claim.paidAt || claim.date || '').slice(0, 10),
      notes: `Reembolso al empleado ${claim.employeeId}${claim.category ? ` · ${claim.category}` : ''}`,
      paid: 1,
      paymentMethod: claim.paymentMethod || 'transfer',
      source: REIMBURSEMENT_EXPENSE_SOURCE,
      sourceId: claim.id,
    },
    { id: 'system', role: 'super_admin', hotelId: claim.hotelId },
  )
}
