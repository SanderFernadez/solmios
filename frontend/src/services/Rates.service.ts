import { http } from './http'

export interface RoomRate {
  id?: string
  hotelId?: string
  roomType: string
  occupancy: number
  season: string
  price: number
}

export const RatesService = {
  list: () => http.get<{ data: RoomRate[] }>('/rates'),
  save: (rates: RoomRate[]) => http.put<{ success: boolean; count: number }>('/rates', { rates }),
  copyNextYear: () => http.post<{ success: boolean; copied: number; total: number }>('/rates/copy-next-year'),
}
