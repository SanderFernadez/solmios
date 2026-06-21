import { http } from './http'

export interface CajaMovement {
  id: string
  date: string
  amount: number
  guestName?: string
  concept: string
  method: 'cash' | 'card' | 'transfer' | 'link' | 'other'
  roomNumber?: string
  createdAt?: string
}

export interface CajaSummary {
  total: number
  byMethod: Record<string, number>
  count: number
}

export const CajaService = {
  list: () => http.get<{ data: CajaMovement[] }>('/caja'),
  create: (data: Omit<CajaMovement, 'id' | 'createdAt'>) => http.post<CajaMovement>('/caja', data),
  remove: (id: string) => http.delete<{ success: boolean }>(`/caja/${id}`),
}
