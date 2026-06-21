import { http } from './http'

export interface Gasto {
  id?: string
  hotelId?: string
  date?: string
  category?: string
  description?: string
  amount: number
  currency?: string
  supplier?: string
  status?: 'pending' | 'approved' | 'paid' | 'rejected'
  createdBy?: string
}

export const GastosService = {
  list: (hotelId?: string) => http.get<{ data: Gasto[] }>(`/gastos${hotelId ? `?hotelId=${hotelId}` : ''}`),
  create: (data: Omit<Gasto, 'id'>) => http.post<Gasto>('/gastos', data),
  update: (id: string, data: Partial<Gasto>) => http.put<Gasto>(`/gastos/${id}`, data),
  remove: (id: string, hotelId?: string) => http.delete<{ success: boolean }>(`/gastos/${id}${hotelId ? `?hotelId=${hotelId}` : ''}`),
}
