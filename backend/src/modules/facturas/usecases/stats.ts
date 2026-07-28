// facturas/usecases/stats.ts — Estadísticas de facturación pura (sin ORM, sin HTTP).
// Extraída del service para mantenerlo < 200 líneas.
//
// Semántica de campos (separación counts vs montos, al estilo *Revenue):
//   counts (nº de documentos): total, paid, cancelled
//   montos ($):                pendingAmount, overdueAmount, monthlyRevenue, todayRevenue, totalTax
// pendingAmount/overdueAmount acumulan el SALDO (`amount - amountPaid`) de las facturas
// pendientes/vencidas — la tarjeta "Pendiente" del billing muestra lo que falta cobrar,
// no el total facturado. Una factura de $100 con $80 cobrados debe pesar $20, no $100.
//
// Solo se consideran documentos `type: 'invoice'`. Históricamente `pay()` marcaba la factura
// como `paid` Y creaba un comprobante `type: 'payment'` con el mismo monto en esta misma tabla —
// sumar ambos duplicaba cada cobro en monthlyRevenue/todayRevenue e inflaba los counts.
// BM-4 (billing-money-consolidation) eliminó ese camino: el cobro ahora se asienta en `payments`,
// no en `invoices`, así que ya no se generan filas `type:'payment'`/`'folio'` nuevas. El filtro
// se MANTIENE de todos modos como defensa ante datos históricos que pudieran seguir existiendo en
// una DB de antes del cambio (prod verificado en 0 filas, pero no es una garantía universal).

import type { RepositoryAdapter, CacheAdapter } from 'arckode-framework'
import type { FacturasDTO, FacturasStats, CurrentUser } from '../types'
import { hotelFilterFor } from './billing'

export async function getFacturasStats(
  repo: RepositoryAdapter<FacturasDTO>,
  hotelFilter: Record<string, unknown>,
): Promise<FacturasStats> {
  const all = await repo.findMany({ ...hotelFilter, type: 'invoice' })
  const today = new Date().toISOString().split('T')[0]
  const monthStart = new Date().toISOString().slice(0, 7) + '-01'

  let total = 0, pendingAmount = 0, paid = 0, overdueAmount = 0, cancelled = 0
  let monthlyRevenue = 0, todayRevenue = 0, totalTax = 0

  for (const inv of all) {
    total++
    const status = String(inv.status || 'pending')
    const amount = Number(inv.amount) || 0
    const amountPaid = Number(inv.amountPaid) || 0
    const taxes = Number(inv.taxes) || 0
    const issueDate = String(inv.issueDate || '')
    const outstanding = Math.max(0, amount - amountPaid)

    if (status === 'pending') pendingAmount += outstanding
    else if (status === 'paid') {
      paid++
      totalTax += taxes
      if (issueDate >= monthStart) monthlyRevenue += amount
      if (issueDate === today) todayRevenue += amount
    } else if (status === 'overdue') overdueAmount += outstanding
    else if (status === 'cancelled') cancelled++
  }

  return { total, pendingAmount, paid, overdueAmount, cancelled, monthlyRevenue, todayRevenue, totalTax }
}

/** Stats con cache + filtro multi-tenant resuelto desde el usuario. Wrapper de getFacturasStats. */
export async function getStatsForUser(
  repo: RepositoryAdapter<FacturasDTO>,
  cache: CacheAdapter,
  user: CurrentUser,
): Promise<FacturasStats> {
  const cacheKey = `facturas:stats:${user.hotelId || 'all'}`
  const cached = await cache.get(cacheKey)
  if (cached) return cached as FacturasStats
  const stats = await getFacturasStats(repo, hotelFilterFor(user))
  await cache.set(cacheKey, stats, 120)
  return stats
}
