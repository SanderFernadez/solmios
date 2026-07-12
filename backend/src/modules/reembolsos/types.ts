// reembolsos/types.ts — DTOs del módulo de reembolsos.

export const CLAIM_STATUSES = ['draft', 'submitted', 'approved', 'rejected', 'paid'] as const
export type ClaimStatus = typeof CLAIM_STATUSES[number]

export interface ExpenseClaimDTO {
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

export interface CreateExpenseClaimDTO {
  hotelId: string
  employeeId: string
  category?: string
  description: string
  amount: number
  currency?: string
  date: string
  receiptUrl?: string
  notes?: string
}

export interface UpdateExpenseClaimDTO {
  category?: string
  description?: string
  amount?: number
  currency?: string
  date?: string
  receiptUrl?: string
  notes?: string
}

// Alias del contrato público del módulo.
export type ReembolsosDTO = ExpenseClaimDTO
export type CreateReembolsosDTO = CreateExpenseClaimDTO
export type UpdateReembolsosDTO = UpdateExpenseClaimDTO

export interface ReembolsosQuery {
  hotelId?: string
  employeeId?: string
  status?: string
  page?: number
  limit?: number
}

export interface ReembolsosPaginated {
  data: ExpenseClaimDTO[]
  pagination: { page: number; limit: number; total: number; totalPages: number; hasNext: boolean; hasPrev: boolean }
}

/** Totales por estado, para el resumen (ej: cuánto hay pendiente de pagar). */
export interface ClaimTotals {
  submitted: { count: number; amount: number }
  approved: { count: number; amount: number }
  paid: { count: number; amount: number }
}
