// facturas/usecases/stats.ts — Estadísticas de facturación pura (sin ORM, sin HTTP).
// Extraída del service para mantenerlo < 200 líneas.

import type { RepositoryAdapter } from 'arckode-framework'
import type { FacturasDTO, FacturasStats } from '../types'

export async function getFacturasStats(
  repo: RepositoryAdapter<FacturasDTO>,
  hotelFilter: Record<string, unknown>,
): Promise<FacturasStats> {
  const all = await repo.findMany(hotelFilter)
  const today = new Date().toISOString().split('T')[0]
  const monthStart = new Date().toISOString().slice(0, 7) + '-01'

  let total = 0, pending = 0, paid = 0, overdue = 0, cancelled = 0
  let monthlyRevenue = 0, todayRevenue = 0, totalTax = 0

  for (const inv of all) {
    total++
    const status = String(inv.status || 'pending')
    const amount = Number(inv.amount) || 0
    const taxes = Number(inv.taxes) || 0
    const issueDate = String(inv.issueDate || '')

    if (status === 'pending') pending++
    else if (status === 'paid') {
      paid++
      totalTax += taxes
      if (issueDate >= monthStart) monthlyRevenue += amount
      if (issueDate === today) todayRevenue += amount
    } else if (status === 'overdue') overdue++
    else if (status === 'cancelled') cancelled++
  }

  return { total, pending, paid, overdue, cancelled, monthlyRevenue, todayRevenue, totalTax }
}
