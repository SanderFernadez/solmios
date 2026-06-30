import { http } from './http'

export interface PhotoEvidence {
  url: string
  path?: string
  name: string
  size: number
  mimeType: string
  uploadedAt: string
}

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
  startTime?: string
  endTime?: string
  photos?: PhotoEvidence[]
  cleaningItems?: any
  createdAt: string
  updatedAt: string
}

export interface StaffStats {
  staffId: string
  completed: number
  avgDurationMs: number
  totalDurationMs: number
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
  // ─── Endpoints de administración (F3 backend) ──────────────────────────────
  async start(id: string) {
    return http.put<HousekeepingTask>(`/housekeeping/${id}/start`)
  },
  async complete(id: string) {
    return http.put<HousekeepingTask>(`/housekeeping/${id}/complete`)
  },
  async uploadPhoto(id: string, photo: string, fileName: string) {
    // La foto viaja como data URL base64 en JSON: el router del framework no propaga
    // req.files al handler, así que multipart no llega. El controller decodifica base64 → archivo.
    return http.post<HousekeepingTask>(`/housekeeping/${id}/photos`, { photo, fileName })
  },
  async removePhoto(id: string, photoUrl: string) {
    return http.delete<HousekeepingTask>(`/housekeeping/${id}/photos?url=${encodeURIComponent(photoUrl)}`)
  },
  async stats(hotelId?: string, from?: string, to?: string) {
    const params = new URLSearchParams()
    if (hotelId) params.set('hotelId', hotelId)
    if (from) params.set('from', from)
    if (to) params.set('to', to)
    const query = params.toString() ? `?${params.toString()}` : ''
    return http.get<StaffStats[]>(`/housekeeping/stats${query}`)
  },
}
