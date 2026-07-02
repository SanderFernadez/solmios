// services/Gastos.service.ts — API client for expenses
import { http } from './http'

export interface Gasto {
  id?: string
  hotelId: string
  concept: string
  amount: number
  category?: string
  date?: string
  provider?: string
  invoiceNumber?: string
  notes?: string
  paid?: number
}

export const GastosService = {
  list: (hotelId?: string, page = 1, limit = 20) =>
    http.get<{ data: Gasto[]; total: number; pages: number; hasNext: boolean; hasPrev: boolean }>(
      `/gastos?${[hotelId ? `hotelId=${hotelId}` : '', `page=${page}`, `limit=${limit}`].filter(Boolean).join('&')}`,
    ),
  create: (data: Omit<Gasto, 'id'>) => http.post<Gasto>('/gastos', data),
  update: (id: string, data: Partial<Gasto>) => http.put<Gasto>(`/gastos/${id}`, data),
  remove: (id: string, hotelId?: string) => http.delete<{ success: boolean }>(`/gastos/${id}${hotelId ? `?hotelId=${hotelId}` : ''}`),
}
