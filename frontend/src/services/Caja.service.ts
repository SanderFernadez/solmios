// services/Caja.service.ts — API client para el módulo Caja (canónico).
// method SIEMPRE en inglés (cash|card|transfer|link|other) — el backend lo persiste así.
import { http } from './http'

export interface CashMovement {
  id?: string
  type: 'income' | 'expense' | 'opening' | 'closing'
  amount: number
  method?: 'cash' | 'card' | 'transfer' | 'link' | 'other'
  concept?: string
  category?: string
  source?: string           // manual | payment_connector | migrated
  guestName?: string
  roomNumber?: string
  reservationId?: string
  folioId?: string
  reference?: string
  notes?: string
  shiftId?: string | null
  createdAt?: string
}

export interface CashShift {
  id: string
  status: 'open' | 'closed'
  openingAmount: number
  countedAmount?: number
  expectedAmount?: number
  difference?: number
  openedBy?: string
  closedBy?: string
  openedAt?: string
  closedAt?: string
}

export interface CashStats { today: number; week: number; month: number; count: number; byMethod: Record<string, number> }
export interface MovementList { data: CashMovement[]; total: number; pages: number; hasNext: boolean; hasPrev: boolean }
export interface Reconcile {
  opening: number; income: number; expense: number
  expected: number; counted: number; difference: number; byMethod: Record<string, number>
}

export const CajaService = {
  movements: (params: Record<string, string | number> = {}) => {
    const qs = Object.entries(params).filter(([, v]) => v !== undefined && v !== '').map(([k, v]) => `${k}=${v}`).join('&')
    return http.get<MovementList>(`/caja/movements${qs ? '?' + qs : ''}`)
  },
  createMovement: (data: Partial<CashMovement>) => http.post<CashMovement>('/caja/movements', data),
  updateMovement: (id: string, data: Partial<CashMovement>) => http.put<CashMovement>(`/caja/movements/${id}`, data),
  removeMovement: (id: string) => http.delete<{ success: boolean }>(`/caja/movements/${id}`),
  currentShift: () => http.get<CashShift | null>('/caja/shifts/current'),
  openShift: (openingAmount: number) => http.post<CashShift>('/caja/shifts/open', { openingAmount }),
  closeShift: (id: string, countedAmount: number, denominations?: string) =>
    http.post<CashShift>(`/caja/shifts/${id}/close`, { countedAmount, denominations }),
  reconcile: (id: string) => http.get<Reconcile>(`/caja/shifts/${id}/reconcile`),
  stats: () => http.get<CashStats>('/caja/stats'),
}
