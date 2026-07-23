// accounting/usecases/reports.ts — Reportes contables (CTB-5 mayor + comprobación, CTB-6 P&L + balance).
// Leen SOLO asientos POSTEADOS (los draft no cuentan). Agregan en memoria (findMany + reduce):
// correcto y simple; para volúmenes grandes migrar a agregación SQL (deuda de PERF, no de correctitud).
import type { RepositoryAdapter } from 'arckode-framework'
import type { AccountDTO, AccountType } from '../types'

export interface ReportDeps {
  accounts: RepositoryAdapter<AccountDTO>
  entries: RepositoryAdapter<any>
  lines: RepositoryAdapter<any>
}

const round2 = (n: number) => Math.round((n + Number.EPSILON) * 100) / 100

interface AnnotatedLine {
  accountId: string; code: string; name: string; type: AccountType
  debit: number; credit: number; entryDate: string; entryId: string
}

/** Carga las líneas de los asientos POSTEADOS del hotel, anotadas con la cuenta, filtrando por fecha/período. */
async function postedLines(
  deps: ReportDeps, hotelId: string, opts: { from?: string; to?: string; uptoPeriod?: string; period?: string } = {},
): Promise<{ lines: AnnotatedLine[]; accounts: Map<string, AccountDTO> }> {
  const accs = await deps.accounts.findMany({ hotelId })
  const byId = new Map<string, AccountDTO>(accs.map((a) => [a.id, a]))
  const entries = (await deps.entries.findMany({ hotelId })) as any[]
  const out: AnnotatedLine[] = []
  for (const e of entries) {
    if (e.status !== 'posted') continue
    if (opts.period && e.period !== opts.period) continue
    if (opts.uptoPeriod && String(e.period) > opts.uptoPeriod) continue
    if (opts.from && String(e.entryDate) < opts.from) continue
    if (opts.to && String(e.entryDate) > opts.to) continue
    const ls = (await deps.lines.findMany({ entryId: e.id })) as any[]
    for (const l of ls) {
      const acc = byId.get(l.accountId)
      if (!acc) continue
      out.push({ accountId: l.accountId, code: acc.code, name: acc.name, type: acc.type as AccountType, debit: Number(l.debit || 0), credit: Number(l.credit || 0), entryDate: String(e.entryDate), entryId: e.id })
    }
  }
  return { lines: out, accounts: byId }
}

/** Balance de comprobación (CTB-5): saldo deudor/acreedor por cuenta + totales (deben cuadrar). */
export async function trialBalance(deps: ReportDeps, hotelId: string, period?: string) {
  const { lines } = await postedLines(deps, hotelId, { period })
  const map = new Map<string, { code: string; name: string; type: AccountType; debit: number; credit: number }>()
  for (const l of lines) {
    const row = map.get(l.accountId) ?? { code: l.code, name: l.name, type: l.type, debit: 0, credit: 0 }
    row.debit += l.debit; row.credit += l.credit
    map.set(l.accountId, row)
  }
  const rows = [...map.values()].map((r) => ({ ...r, debit: round2(r.debit), credit: round2(r.credit), balance: round2(r.debit - r.credit) }))
    .sort((a, b) => a.code.localeCompare(b.code))
  const totalDebit = round2(rows.reduce((s, r) => s + r.debit, 0))
  const totalCredit = round2(rows.reduce((s, r) => s + r.credit, 0))
  return { rows, totalDebit, totalCredit, balanced: Math.abs(totalDebit - totalCredit) < 0.005 }
}

/** Libro mayor de una cuenta (CTB-5): movimientos ordenados por fecha + saldo corriente. */
export async function generalLedger(deps: ReportDeps, hotelId: string, accountId: string) {
  const { lines, accounts } = await postedLines(deps, hotelId, {})
  const acc = accounts.get(accountId)
  const mine = lines.filter((l) => l.accountId === accountId).sort((a, b) => a.entryDate.localeCompare(b.entryDate))
  let balance = 0
  const movements = mine.map((l) => { balance += l.debit - l.credit; return { entryId: l.entryId, date: l.entryDate, debit: round2(l.debit), credit: round2(l.credit), balance: round2(balance) } })
  return { account: acc ? { id: acc.id, code: acc.code, name: acc.name, type: acc.type } : null, movements, balance: round2(balance) }
}

/** Estado de resultados / P&L (CTB-6, base devengado): Ingresos(4) − Gastos(5) = Resultado. */
export async function profitLoss(deps: ReportDeps, hotelId: string, from?: string, to?: string) {
  const { lines } = await postedLines(deps, hotelId, { from, to })
  const byAccount = new Map<string, { code: string; name: string; type: AccountType; amount: number }>()
  let revenue = 0, expense = 0
  for (const l of lines) {
    if (l.type === 'income') {
      const amt = l.credit - l.debit; revenue += amt
      const r = byAccount.get(l.accountId) ?? { code: l.code, name: l.name, type: l.type, amount: 0 }; r.amount += amt; byAccount.set(l.accountId, r)
    } else if (l.type === 'expense') {
      const amt = l.debit - l.credit; expense += amt
      const r = byAccount.get(l.accountId) ?? { code: l.code, name: l.name, type: l.type, amount: 0 }; r.amount += amt; byAccount.set(l.accountId, r)
    }
  }
  revenue = round2(revenue); expense = round2(expense)
  const rows = [...byAccount.values()].map((r) => ({ ...r, amount: round2(r.amount) })).sort((a, b) => a.code.localeCompare(b.code))
  return { revenue, expense, result: round2(revenue - expense), basis: 'accrual' as const, rows }
}

/** Balance general (CTB-6) al cierre de un período: Activo = Pasivo + Patrimonio (incluye resultado). */
export async function balanceSheet(deps: ReportDeps, hotelId: string, uptoPeriod?: string) {
  const { lines } = await postedLines(deps, hotelId, { uptoPeriod })
  let assets = 0, liabilities = 0, equity = 0, revenue = 0, expense = 0
  for (const l of lines) {
    switch (l.type) {
      case 'asset': assets += l.debit - l.credit; break
      case 'liability': liabilities += l.credit - l.debit; break
      case 'equity': equity += l.credit - l.debit; break
      case 'income': revenue += l.credit - l.debit; break
      case 'expense': expense += l.debit - l.credit; break
    }
  }
  const netIncome = round2(revenue - expense)
  assets = round2(assets); liabilities = round2(liabilities)
  const equityWithResult = round2(equity + netIncome)   // el resultado del ejercicio es parte del patrimonio
  return {
    assets, liabilities, equity: equityWithResult, netIncome,
    balanced: Math.abs(assets - (liabilities + equityWithResult)) < 0.005,
  }
}
