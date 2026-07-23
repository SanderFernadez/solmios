// treasury/usecases/liquidity.ts — Reportes de liquidez (TES-2 flujo de caja, TES-3 AR, TES-4 AP).
// Leen tablas existentes (payments/expenses/invoices) por hotelId — patrón del módulo reports, sin
// duplicar datos. Consistentes con reports/money.ts: cobrado = payments (charge), NUNCA depósitos.
import type { RepositoryAdapter } from 'arckode-framework'

export interface LiquidityDeps {
  payments: RepositoryAdapter<any>
  expenses: RepositoryAdapter<any>
  invoices: RepositoryAdapter<any>
}

const MS_PER_DAY = 86_400_000
const round2 = (n: number) => Math.round((n + Number.EPSILON) * 100) / 100
const dayKey = (d: string, group: 'day' | 'month') => (group === 'day' ? String(d).slice(0, 10) : String(d).slice(0, 7))

/** Días de antigüedad de una fecha respecto de `asOf` (hoy por defecto). */
function daysOld(date: string, asOf: number): number {
  const t = new Date(String(date).slice(0, 10)).getTime()
  if (Number.isNaN(t)) return 0
  return Math.floor((asOf - t) / MS_PER_DAY)
}
function agingBucket(days: number): 'current' | '1-30' | '31-60' | '61-90' | '90+' {
  if (days <= 0) return 'current'
  if (days <= 30) return '1-30'
  if (days <= 60) return '31-60'
  if (days <= 90) return '61-90'
  return '90+'
}
const emptyAging = () => ({ current: 0, '1-30': 0, '31-60': 0, '61-90': 0, '90+': 0 })

/** TES-2 — Flujo de caja: entradas (cobros) − salidas (gastos pagados) por período + acumulado. */
export async function cashFlow(deps: LiquidityDeps, hotelId: string, from?: string, to?: string, group: 'day' | 'month' = 'month') {
  const pays = (await deps.payments.findMany({ hotelId })) as any[]
  const exps = (await deps.expenses.findMany({ hotelId })) as any[]
  // processedAt es ISO completo; from/to llegan date-only (YYYY-MM-DD). Normalizar AMBOS a día,
  // si no `'2026-07-31T14:..' <= '2026-07-31'` da false y se pierden los cobros del último día.
  const inRange = (d: string) => { const day = String(d).slice(0, 10); return (!from || day >= from) && (!to || day <= to) }
  const buckets = new Map<string, { inflow: number; outflow: number }>()
  const bump = (key: string, field: 'inflow' | 'outflow', amt: number) => {
    const b = buckets.get(key) ?? { inflow: 0, outflow: 0 }; b[field] += amt; buckets.set(key, b)
  }
  for (const p of pays) {
    if (p.status !== 'completed') continue
    const d = p.processedAt || p.createdAt; if (!d || !inRange(d)) continue
    // Cobrado NETO = charge − refund (igual que reports/money.ts::sumCollected). Un reembolso baja
    // el efectivo. Depósitos/withdrawals NO son ingreso (son garantía/movimiento, no cobro).
    if (p.type === 'charge') bump(dayKey(d, group), 'inflow', Number(p.amount || 0))
    else if (p.type === 'refund') bump(dayKey(d, group), 'inflow', -Number(p.amount || 0))
  }
  for (const e of exps) {
    if (!e.paid) continue
    const d = e.date || e.createdAt; if (!d || !inRange(d)) continue
    bump(dayKey(d, group), 'outflow', Number(e.amount || 0))
  }
  let running = 0
  const rows = [...buckets.entries()].sort(([a], [b]) => a.localeCompare(b)).map(([period, b]) => {
    const net = round2(b.inflow - b.outflow); running = round2(running + net)
    return { period, inflow: round2(b.inflow), outflow: round2(b.outflow), net, balance: running }
  })
  const totalIn = round2(rows.reduce((s, r) => s + r.inflow, 0))
  const totalOut = round2(rows.reduce((s, r) => s + r.outflow, 0))
  return { rows, totalIn, totalOut, net: round2(totalIn - totalOut) }
}

/** TES-3 — Cuentas por cobrar (AR) con aging: facturas con saldo pendiente, por huésped. */
export async function receivables(deps: LiquidityDeps, hotelId: string, asOf = Date.now()) {
  const invoices = (await deps.invoices.findMany({ hotelId })) as any[]
  const byGuest = new Map<string, { guestId: string; outstanding: number; aging: ReturnType<typeof emptyAging> }>()
  let total = 0
  const totals = emptyAging()
  for (const inv of invoices) {
    if ((inv.type ?? 'invoice') !== 'invoice') continue   // 'payment'/'folio' no son deuda
    const outstanding = Number(inv.amount || 0) - Number(inv.amountPaid || 0)
    if (outstanding <= 0) continue
    const key = inv.guestId || inv.invoiceNumber || inv.id
    const bucket = agingBucket(daysOld(inv.dueDate || inv.issueDate, asOf))
    const row = byGuest.get(key) ?? { guestId: inv.guestId || key, outstanding: 0, aging: emptyAging() }
    row.outstanding += outstanding; row.aging[bucket] += outstanding
    byGuest.set(key, row)
    total += outstanding; totals[bucket] += outstanding
  }
  const rows = [...byGuest.values()].map((r) => ({ ...r, outstanding: round2(r.outstanding) }))
  return { rows, total: round2(total), aging: totals }
}

/** TES-4 — Cuentas por pagar (AP) con aging: gastos impagos, por proveedor. */
export async function payables(deps: LiquidityDeps, hotelId: string, asOf = Date.now()) {
  const exps = (await deps.expenses.findMany({ hotelId })) as any[]
  const byProvider = new Map<string, { provider: string; supplierId?: string; owed: number; aging: ReturnType<typeof emptyAging> }>()
  let total = 0
  const totals = emptyAging()
  for (const e of exps) {
    if (e.paid) continue
    const owed = Number(e.amount || 0); if (owed <= 0) continue
    const key = e.supplierId || e.provider || 'Sin proveedor'
    const bucket = agingBucket(daysOld(e.date || e.createdAt, asOf))
    const row = byProvider.get(key) ?? { provider: e.provider || 'Sin proveedor', supplierId: e.supplierId, owed: 0, aging: emptyAging() }
    row.owed += owed; row.aging[bucket] += owed
    byProvider.set(key, row)
    total += owed; totals[bucket] += owed
  }
  const rows = [...byProvider.values()].map((r) => ({ ...r, owed: round2(r.owed) }))
  return { rows, total: round2(total), aging: totals }
}
