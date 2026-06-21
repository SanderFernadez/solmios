import { http } from './http'

export interface SupportTicket {
  id: string
  hotelId: string
  userId: string
  subject: string
  category?: string
  priority?: string
  status?: string
  description?: string
  assignedTo?: string
  messages?: any[]
  createdAt: string
  updatedAt: string
}

export const TicketsService = {
  async list(hotelId?: string) {
    const query = hotelId ? `?hotelId=${hotelId}` : ''
    return http.get<{ data: SupportTicket[]; total: number }>(`/tickets${query}`)
  },
  async getById(id: string) {
    return http.get<SupportTicket>(`/tickets/${id}`)
  },
  async create(data: Partial<SupportTicket>) {
    return http.post<SupportTicket>('/tickets', data)
  },
  async update(id: string, data: Partial<SupportTicket>) {
    return http.put<SupportTicket>(`/tickets/${id}`, data)
  },
  async delete(id: string) {
    return http.delete(`/tickets/${id}`)
  },
}
