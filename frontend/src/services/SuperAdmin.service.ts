import { http } from './http'
import type { HotelData } from './Hotel.service'

export interface AdminUser {
  id: string
  name: string
  email: string
  role: string
  hotelId: string | null
  hotelName?: string
  activo?: number
  createdAt?: string
}

export interface AdminAnalytics {
  mrr: number
  totalHoteles: number
  totalUsuarios: number
  totalReservas: number
  activeHotels: number
  byPlan: Record<string, number>
  avgOccupancy: number
  avgADR: number
  hotelsBreakdown?: Array<{ id: string; name: string; plan: string; status: string; mrr: number; rooms: number; reservations: number; occupancy: number; adr: number; revenue: number }>
  npsScore: number
  ticketPromedio: number
}

export interface AdminHotel extends HotelData {
  roomCount: number
}

export const SuperAdminService = {
  async hotels(): Promise<{ hotels: AdminHotel[]; total: number }> {
    const data = await http.get<{ data: any[]; total: number }>('/admin/hoteles')
    return {
      hotels: data.data.map((h: any) => ({
        ...h,
        name: h.name,
        location: h.address || h.location,
        roomCount: h.roomCount ?? 0,
      })),
      total: data.total,
    }
  },

  async users(): Promise<{ users: AdminUser[]; total: number }> {
    const data = await http.get<{ data: any[]; total: number }>('/admin/users')
    return {
      users: data.data.map((u: any) => ({ ...u, name: u.name, hotelName: u.hotelName })),
      total: data.total,
    }
  },

  async analytics(): Promise<AdminAnalytics> {
    return http.get<AdminAnalytics>('/admin/analytics')
  },
}
