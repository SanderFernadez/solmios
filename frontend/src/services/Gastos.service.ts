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
  list: (hotelId?: string) => http.get<{ data: Gasto[] }>(`/gastos${hotelId ? `?hotelId=${hotelId}` : ''}`),
  create: (data: Omit<Gasto, 'id'>) => http.post<Gasto>('/gastos', data),
  update: (id: string, data: Partial<Gasto>) => http.put<Gasto>(`/gastos/${id}`, data),
  remove: (id: string, hotelId?: string) => http.delete<{ success: boolean }>(`/gastos/${id}${hotelId ? `?hotelId=${hotelId}` : ''}`),
}
