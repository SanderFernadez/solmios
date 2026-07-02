// cash/usecases/reconcile.ts — Arqueo de turno (funciones puras, sin side-effects).
// Expected = opening + income − expense. Difference = counted − expected.

import type { CashMovementDTO, CashShiftDTO, ReconcileResult } from '../types'

/** Suma ingresos/egresos y desglose por método de una lista de movimientos. Pura. */
export function summarizeMovements(movs: CashMovementDTO[]) {
  let income = 0, expense = 0
  const byMethod: Record<string, number> = {}
  for (const m of movs) {
    if (m.type === 'income' || m.type === 'opening') income += m.amount
    else if (m.type === 'expense' || m.type === 'closing') expense += m.amount
    const mk = m.method || 'cash'
    byMethod[mk] = (byMethod[mk] || 0) + m.amount
  }
  return { income, expense, byMethod }
}

/** Calcula el arqueo completo de un turno. Pura. */
export function reconcileShift(shift: CashShiftDTO, movs: CashMovementDTO[]): ReconcileResult {
  const { income, expense, byMethod } = summarizeMovements(movs)
  const opening = shift.openingAmount || 0
  const expected = opening + income - expense
  const counted = shift.countedAmount ?? 0
  return { shift, opening, income, expense, expected, counted, difference: counted - expected, byMethod }
}
