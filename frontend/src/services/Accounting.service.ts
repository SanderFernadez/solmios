// Accounting.service.ts — Cliente de la API de contabilidad (CTB-7). Todas las rutas bajo /api/accounting.
import { http } from './http'

export type AccountType = 'asset' | 'liability' | 'equity' | 'income' | 'expense'

export interface Account {
  id: string
  code: string
  name: string
  type: AccountType
  parentId?: string
  isPostable?: number
  active?: number
}

export interface JournalLine {
  accountId: string
  debit?: number
  credit?: number
  description?: string
}

export interface JournalEntry {
  id: string
  entryDate: string
  description?: string
  reference?: string
  referenceType?: string
  period: string
  status: 'draft' | 'posted' | 'reversed'
  source?: string
  lines?: (JournalLine & { id: string })[]
}

export interface AccountingPeriod {
  id: string
  period: string
  status: 'open' | 'closed' | 'locked'
  startDate?: string
  endDate?: string
}

export interface TrialBalanceRow { code: string; name: string; type: AccountType; debit: number; credit: number; balance: number }
export interface TrialBalance { rows: TrialBalanceRow[]; totalDebit: number; totalCredit: number; balanced: boolean }
export interface PnL { revenue: number; expense: number; result: number; basis: string; rows: { code: string; name: string; type: AccountType; amount: number }[] }
export interface BalanceSheet { assets: number; liabilities: number; equity: number; netIncome: number; balanced: boolean }
export interface Ledger { account: { id: string; code: string; name: string; type: AccountType } | null; movements: { entryId: string; date: string; debit: number; credit: number; balance: number }[]; balance: number }

export const AccountingService = {
  // Plan de cuentas
  listAccounts: () => http.get<{ data: Account[]; total: number }>('/accounting/accounts'),
  createAccount: (dto: Partial<Account>) => http.post<Account>('/accounting/accounts', dto),
  updateAccount: (id: string, dto: Partial<Account>) => http.put<Account>(`/accounting/accounts/${id}`, dto),
  deleteAccount: (id: string) => http.delete<void>(`/accounting/accounts/${id}`),
  seedChart: () => http.post<{ created: number; total: number }>('/accounting/seed'),

  // Asientos
  listJournal: (period?: string) => http.get<{ data: JournalEntry[]; total: number }>(`/accounting/journal${period ? `?period=${period}` : ''}`),
  createEntry: (dto: { entryDate: string; description?: string; reference?: string; lines: JournalLine[] }) =>
    http.post<{ id: string; deduped: boolean }>('/accounting/journal', dto),
  postEntry: (id: string) => http.post<{ ok: boolean }>(`/accounting/journal/${id}/post`),
  reverseEntry: (id: string) => http.post<{ reversalId: string }>(`/accounting/journal/${id}/reverse`),

  // Períodos
  listPeriods: () => http.get<{ data: AccountingPeriod[]; total: number }>('/accounting/periods'),
  closePeriod: (id: string) => http.post<{ ok: boolean }>(`/accounting/periods/${id}/close`),
  lockPeriod: (id: string) => http.post<{ ok: boolean }>(`/accounting/periods/${id}/lock`),

  // Reportes
  trialBalance: (period?: string) => http.get<TrialBalance>(`/accounting/trial-balance${period ? `?period=${period}` : ''}`),
  ledger: (accountId: string) => http.get<Ledger>(`/accounting/ledger?account=${accountId}`),
  pnl: (from?: string, to?: string) => http.get<PnL>(`/accounting/pnl?from=${from ?? ''}&to=${to ?? ''}`),
  balanceSheet: (period?: string) => http.get<BalanceSheet>(`/accounting/balance-sheet${period ? `?period=${period}` : ''}`),
}
