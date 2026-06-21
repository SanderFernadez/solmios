import { http } from './http'

export interface HousekeepingTask {
  id: string
  roomId: string
  hotelId: string
  staffId?: string
  type?: string
  priority?: string
  status?: string
  notes?: string
  assignedDate?: string
  completedDate?: string
  cleaningItems?: any
  createdAt: string
  updatedAt: string
}

export const HousekeepingService = {
  async list(hotelId?: string) {
    const query = hotelId ? `?hotelId=${hotelId}` : ''
    return http.get<{ data: HousekeepingTask[]; total: number }>(`/housekeeping${query}`)
  },
  async getById(id: string) {
    return http.get<HousekeepingTask>(`/housekeeping/${id}`)
  },
  async create(data: Partial<HousekeepingTask>) {
    return http.post<HousekeepingTask>('/housekeeping', data)
  },
  async update(id: string, data: Partial<HousekeepingTask>) {
    return http.put<HousekeepingTask>(`/housekeeping/${id}`, data)
  },
  async delete(id: string) {
    return http.delete(`/housekeeping/${id}`)
  },
}
