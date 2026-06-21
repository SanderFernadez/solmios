import { http } from './http'

export interface Companion {
  id?: string
  reservationId?: string
  name: string
  documentType?: string
  documentNumber?: string
  nationality?: string
  birthDate?: string
  isMainGuest?: boolean
}

export const CompanionsService = {
  listByReservation: (reservationId: string) =>
    http.get<{ data: Companion[] }>(`/reservations/${reservationId}/companions`),
  create: (reservationId: string, data: Omit<Companion, 'id' | 'reservationId'>) =>
    http.post<Companion>(`/reservations/${reservationId}/companions`, data),
  update: (id: string, data: Partial<Companion>) =>
    http.put<Companion>(`/companions/${id}`, data),
  remove: (id: string) => http.delete<{ success: boolean }>(`/companions/${id}`),
}
