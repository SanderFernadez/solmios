import { http } from './http'

export interface ReportData {
  totalRevenue: number
  byChannel: Record<string, number>
  occupancyByType: { type: string; total: number; occupied: number; percentage: number }[]
  totalReservations: number
  canceledReservations: number
  dailyRevenue?: { date: string; value: number }[]
  topGuests?: { name: string; stays: number; totalSpent: number }[]
  topCountries?: { name: string; percentage: number }[]
  upcomingArrivals?: { id: string; date: string; source: string }[]
  revenueBreakdown?: { category: string; amount: number }[]
}

export const ReportService = {
  async get(hotelId?: string): Promise<ReportData> {
    const query = hotelId ? `?hotelId=${hotelId}` : ''
    return http.get<ReportData>(`/reports${query}`)
  },
}
