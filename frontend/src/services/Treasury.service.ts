// Treasury.service.ts — Cliente de la API de tesorería (TES-6). Rutas bajo /api/treasury.
import { http } from './http'

export interface Aging { current: number; '1-30': number; '31-60': number; '61-90': number; '90+': number }
export interface CashFlowRow { period: string; inflow: number; outflow: number; net: number; balance: number }
export interface CashFlow { rows: CashFlowRow[]; totalIn: number; totalOut: number; net: number }
export interface ArRow { guestId: string; outstanding: number; aging: Aging }
export interface Receivables { rows: ArRow[]; total: number; aging: Aging }
export interface ApRow { provider: string; supplierId?: string; owed: number; aging: Aging }
export interface Payables { rows: ApRow[]; total: number; aging: Aging }
export interface Supplier { id: string; name: string; taxId?: string; contact?: string; email?: string; phone?: string; active?: number }
export interface BankAccount { id: string; name: string; bank?: string; accountNumber?: string; currency?: string; type?: string; openingBalance?: number; currentBalance?: number; active?: number }
export interface Reconciliation { matched: number; unmatched: { id: string; date: string; amount: number; description?: string }[]; unmatchedCount: number }
export interface Budget { id: string; period: string; category: string; budgetedAmount: number; notes?: string }
export interface BudgetVsActualRow { category: string; budgeted: number; actual: number; variance: number; pctExecuted: number | null; overBudget: boolean }
export interface BudgetVsActual { period: string; rows: BudgetVsActualRow[]; totalBudgeted: number; totalActual: number }

export const TreasuryService = {
  // Liquidez
  cashFlow: (from?: string, to?: string, group: 'day' | 'month' = 'month') =>
    http.get<CashFlow>(`/treasury/cash-flow?from=${from ?? ''}&to=${to ?? ''}&group=${group}`),
  receivables: () => http.get<Receivables>('/treasury/receivables'),
  payables: () => http.get<Payables>('/treasury/payables'),

  // Proveedores
  listSuppliers: () => http.get<{ data: Supplier[]; total: number }>('/treasury/suppliers'),
  createSupplier: (dto: Partial<Supplier>) => http.post<Supplier>('/treasury/suppliers', dto),
  updateSupplier: (id: string, dto: Partial<Supplier>) => http.put<Supplier>(`/treasury/suppliers/${id}`, dto),
  deleteSupplier: (id: string) => http.delete<void>(`/treasury/suppliers/${id}`),

  // Bancos + conciliación
  listBankAccounts: () => http.get<{ data: BankAccount[]; total: number }>('/treasury/bank-accounts'),
  createBankAccount: (dto: Partial<BankAccount>) => http.post<BankAccount>('/treasury/bank-accounts', dto),
  updateBankAccount: (id: string, dto: Partial<BankAccount>) => http.put<BankAccount>(`/treasury/bank-accounts/${id}`, dto),
  importMovements: (id: string, rows: { date: string; description?: string; amount: number; reference?: string }[]) =>
    http.post<{ created: number; total: number }>(`/treasury/bank-accounts/${id}/import`, { rows }),
  reconcile: (bankAccountId: string) => http.post<Reconciliation>('/treasury/reconcile', { bankAccountId }),

  // Presupuesto
  listBudgets: (period?: string) => http.get<{ data: Budget[]; total: number }>(`/treasury/budgets${period ? `?period=${period}` : ''}`),
  createBudget: (dto: Partial<Budget>) => http.post<Budget>('/treasury/budgets', dto),
  updateBudget: (id: string, dto: Partial<Budget>) => http.put<Budget>(`/treasury/budgets/${id}`, dto),
  budgetVsActual: (period: string) => http.get<BudgetVsActual>(`/treasury/budget-vs-actual?period=${period}`),
}
