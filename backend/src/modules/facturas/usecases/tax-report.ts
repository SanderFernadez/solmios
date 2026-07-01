// facturas/usecases/tax-report.ts — Reporte de impuestos por período.
// Calcula impuestos recaudados, facturas pagadas, y desglose por mes.

import type { RepositoryAdapter } from 'arckode-framework'
import type { FacturasDTO } from '../types'

export interface TaxReportEntry {
  month: string
  invoices: number
  totalRevenue: number
  totalTax: number
}

export interface TaxReport {
  period: { from: string; to: string }
  summary: {
    totalInvoices: number
    totalRevenue: number
    totalTax: number
    averageTaxRate: number
  }
  byMonth: TaxReportEntry[]
}

export async function generateTaxReport(
  repo: RepositoryAdapter<FacturasDTO>,
  hotelFilter: Record<string, unknown>,
  from?: string,
  to?: string,
): Promise<TaxReport> {
  const fromDate = from || new Date().toISOString().slice(0, 7) + '-01'
  const toDate = to || new Date().toISOString().split('T')[0]

  const all = await repo.findMany(hotelFilter)

  const paid = all.filter(inv =>
    inv.status === 'paid' &&
    String(inv.issueDate || '') >= fromDate &&
    String(inv.issueDate || '') <= toDate
  )

  const byMonthMap = new Map<string, TaxReportEntry>()
  let totalRevenue = 0, totalTax = 0

  for (const inv of paid) {
    const month = String(inv.issueDate || '').slice(0, 7)
    const amount = Number(inv.amount) || 0
    const taxes = Number(inv.taxes) || 0

    totalRevenue += amount
    totalTax += taxes

    const existing = byMonthMap.get(month) || { month, invoices: 0, totalRevenue: 0, totalTax: 0 }
    existing.invoices++
    existing.totalRevenue += amount
    existing.totalTax += taxes
    byMonthMap.set(month, existing)
  }

  const byMonth = Array.from(byMonthMap.values()).sort((a, b) => a.month.localeCompare(b.month))
  const totalInvoices = paid.length
  const averageTaxRate = totalRevenue > 0 ? Math.round((totalTax / (totalRevenue - totalTax)) * 100) : 0

  return {
    period: { from: fromDate, to: toDate },
    summary: { totalInvoices, totalRevenue, totalTax, averageTaxRate },
    byMonth,
  }
}
