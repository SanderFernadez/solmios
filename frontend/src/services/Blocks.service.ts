import { http } from './http'

export interface RoomBlock {
  id?: string
  hotelId?: string
  roomId: string
  reason?: string
  startDate: string
  endDate: string
  createdBy?: string
  roomNumber?: string
}

export const BlocksService = {
  list: (startDate?: string, endDate?: string) =>
    http.get<{ data: RoomBlock[] }>(`/blocks${startDate && endDate ? `?startDate=${startDate}&endDate=${endDate}` : ''}`),
  create: (roomIds: string[], reason: string, startDate: string, endDate: string) =>
    http.post<{ data: RoomBlock[]; count: number }>('/blocks', { roomIds, reason, startDate, endDate }),
  remove: (id: string) => http.delete<{ success: boolean }>(`/blocks/${id}`),
}
