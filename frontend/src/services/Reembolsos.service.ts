// Reembolsos.service.ts — Cliente del módulo de reembolsos de empleado.
import { http } from './http'

export interface ExpenseClaim {
  id: string
  hotelId: string
  employeeId: string
  category: string
  description: string
  amount: number
  currency: string
  date: string
  status: string
  receiptUrl: string
  notes: string
  approvedBy: string | null
  approvedAt: string | null
  rejectReason: string
  paidAt: string | null
  paymentMethod: string
  active: number
  createdAt: string
  updatedAt: string
}

export interface ClaimTotals {
  submitted: { count: number; amount: number }
  approved: { count: number; amount: number }
  paid: { count: number; amount: number }
}

export const ReembolsosService = {
  async list(params?: { employeeId?: string; status?: string }): Promise<ExpenseClaim[]> {
    const qs = params ? '?' + new URLSearchParams(params as Record<string, string>).toString() : ''
    return http.get(`/api/expense-claims${qs}`)
  },
  async totals(): Promise<ClaimTotals> { return http.get('/api/expense-claims/totals') },
  async create(data: Partial<ExpenseClaim>): Promise<ExpenseClaim> { return http.post('/api/expense-claims', data) },
  async submit(id: string): Promise<ExpenseClaim> { return http.post(`/api/expense-claims/${id}/submit`) },
  async approve(id: string): Promise<ExpenseClaim> { return http.post(`/api/expense-claims/${id}/approve`) },
  async reject(id: string, reason: string): Promise<ExpenseClaim> { return http.post(`/api/expense-claims/${id}/reject`, { reason }) },
  async pay(id: string, paymentMethod: string): Promise<ExpenseClaim> { return http.post(`/api/expense-claims/${id}/pay`, { paymentMethod }) },
  async remove(id: string): Promise<void> { return http.delete(`/api/expense-claims/${id}`) },
}
