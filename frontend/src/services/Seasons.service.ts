import { http } from './http'

export interface Season {
  id?: string
  hotelId?: string
  name: string
  label?: string
  startDate?: string
  endDate?: string
  color: string
  sortOrder?: number
}

export const SeasonsService = {
  list: () => http.get<{ data: Season[] }>('/seasons'),
  save: (seasons: Season[]) => http.put<{ success: boolean; count: number }>('/seasons', { seasons }),
}
