// cash/usecases/stats.ts — Stats de ingresos de caja (función pura).

import type { CashMovementDTO, CashStats } from '../types'

const MS_PER_DAY = 24 * 60 * 60 * 1000

/** Calcula totales de ingresos (hoy/semana/mes + por método) sobre los movimientos. Pura. */
export function computeStats(movs: CashMovementDTO[], now: number): CashStats {
  const today = new Date(now).toISOString().slice(0, 10)
  const weekAgo = new Date(now - 7 * MS_PER_DAY).toISOString()
  const monthAgo = new Date(now - 30 * MS_PER_DAY).toISOString()
  let todaySum = 0, weekSum = 0, monthSum = 0
  const byMethod: Record<string, number> = {}
  for (const m of movs) {
    if (m.type === 'expense' || m.type === 'closing') continue
    const c = m.createdAt || ''
    if (c.slice(0, 10) === today) todaySum += m.amount
    if (c >= weekAgo) weekSum += m.amount
    if (c >= monthAgo) monthSum += m.amount
    const mk = m.method || 'cash'
    byMethod[mk] = (byMethod[mk] || 0) + m.amount
  }
  return { today: todaySum, week: weekSum, month: monthSum, count: movs.length, byMethod }
}
