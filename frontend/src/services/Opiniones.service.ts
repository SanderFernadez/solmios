import { http } from './http'

export interface Opinion {
  id?: string
  hotelId?: string
  guestName?: string
  rating: number
  comment?: string
  status?: 'pending' | 'published' | 'rejected'
  source?: 'booking' | 'google' | 'direct' | 'internal'
  createdAt?: string
  reply?: string
}

export const OpinionesService = {
  list: (hotelId?: string) => http.get<{ data: Opinion[] }>(`/opiniones${hotelId ? `?hotelId=${hotelId}` : ''}`),
  create: (data: Omit<Opinion, 'id'>) => http.post<Opinion>('/opiniones', data),
  update: (id: string, data: Partial<Opinion>) => http.put<Opinion>(`/opiniones/${id}`, data),
  remove: (id: string, hotelId?: string) => http.delete<{ success: boolean }>(`/opiniones/${id}${hotelId ? `?hotelId=${hotelId}` : ''}`),
}
