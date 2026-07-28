// CajaChica.service.ts — Fondos fijos (caja chica) y sus reposiciones. v1: sin dinero real, la
// reposición se completa a mano (ver backend/src/modules/caja-chica). Rutas bajo /api/petty-cash/*.
import { http } from './http'

export type PettyCashReplenishmentStatus = 'requested' | 'completed' | 'cancelled'

export interface PettyCashFund {
  id: string
  hotelId: string
  name: string
  custodianId: string
  targetAmount: number
  currentBalance: number
  currency?: string
  active?: number
  notes?: string
  createdAt: string
  updatedAt: string
}

export interface PettyCashReplenishment {
  id: string
  hotelId: string
  fundId: string
  amount: number
  status: PettyCashReplenishmentStatus
  requestedBy?: string
  approvedBy?: string
  sourceBankAccountId?: string
  notes?: string
  createdAt: string
  updatedAt: string
}

export interface CreateFundPayload {
  name: string
  custodianId: string
  targetAmount: number
  currency?: string
  active?: number
  notes?: string
}
export interface UpdateFundPayload {
  name?: string
  custodianId?: string
  targetAmount?: number
  currency?: string
  active?: number
  notes?: string
}
export interface CreateReplenishmentPayload {
  fundId: string
  amount: number
  sourceBankAccountId?: string
  notes?: string
}

export const CajaChicaService = {
  listFunds: () => http.get<{ data: PettyCashFund[]; total: number }>('/petty-cash/funds'),
  getFund: (id: string) => http.get<PettyCashFund>(`/petty-cash/funds/${id}`),
  createFund: (data: CreateFundPayload) => http.post<PettyCashFund>('/petty-cash/funds', data),
  updateFund: (id: string, data: UpdateFundPayload) => http.put<PettyCashFund>(`/petty-cash/funds/${id}`, data),
  deleteFund: (id: string) => http.delete<void>(`/petty-cash/funds/${id}`),

  listReplenishments: (fundId: string) =>
    http.get<{ data: PettyCashReplenishment[]; total: number }>(`/petty-cash/funds/${fundId}/replenishments`),
  requestReplenishment: (data: CreateReplenishmentPayload) =>
    http.post<PettyCashReplenishment>('/petty-cash/replenishments', data),
  completeReplenishment: (id: string) =>
    http.post<PettyCashReplenishment>(`/petty-cash/replenishments/${id}/complete`, {}),
}
