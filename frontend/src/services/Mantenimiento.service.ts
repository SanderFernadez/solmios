import { http } from './http'

export interface MaintenanceTicket {
  id: string
  hotelId: string
  roomId?: string
  roomNumber?: string
  title: string
  description?: string
  category?: string
  priority?: string
  status?: string
  assignedTo?: string
  estimatedCost?: number
  reportedDate?: string
  resolvedDate?: string
  createdAt: string
  updatedAt: string
}

export const MantenimientoService = {
  async list(hotelId?: string) {
    const query = hotelId ? `?hotelId=${hotelId}` : ''
    return http.get<{ data: MaintenanceTicket[]; total: number }>(`/mantenimiento${query}`)
  },
  async getById(id: string) {
    return http.get<MaintenanceTicket>(`/mantenimiento/${id}`)
  },
  async create(data: Partial<MaintenanceTicket>) {
    return http.post<MaintenanceTicket>('/mantenimiento', data)
  },
  async update(id: string, data: Partial<MaintenanceTicket>) {
    return http.put<MaintenanceTicket>(`/mantenimiento/${id}`, data)
  },
  async delete(id: string) {
    return http.delete(`/mantenimiento/${id}`)
  },
}
