import { http } from './http'

export interface Device {
  id: string
  hotelId?: string
  userId?: string
  userName?: string
  device?: string
  icon?: string
  browser?: string
  os?: string
  ip?: string
  isMobile?: number
  lastActivity?: string
  createdAt: string
  updatedAt: string
}

export const DispositivosService = {
  async list(hotelId?: string) {
    const query = hotelId ? `?hotelId=${hotelId}` : ''
    return http.get<{ data: Device[]; total: number }>(`/dispositivos${query}`)
  },
  async getById(id: string) {
    return http.get<Device>(`/dispositivos/${id}`)
  },
  async create(data: Partial<Device>) {
    return http.post<Device>('/dispositivos', data)
  },
  async update(id: string, data: Partial<Device>) {
    return http.put<Device>(`/dispositivos/${id}`, data)
  },
  async delete(id: string) {
    return http.delete(`/dispositivos/${id}`)
  },
}
