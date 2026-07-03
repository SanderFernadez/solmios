export type ReportType = 'facturacion' | 'ocupacion' | 'pernoctaciones' | 'rendimiento' | 'procedencia' | 'reservas'

export interface ReportQueryDTO {
  hotelId?: string
  type?: ReportType
  from?: string
  to?: string
}

export interface NightAuditDTO {
  fecha: string
  ocupacion: number
  habitacionesOcupadas: number
  habitacionesTotales: number
  ingresosHabitaciones: number
  ingresosServicios: number
  impuestos: number
  totalDia: number
  checkins: number
  checkouts: number
  noShows: number
  cancelaciones: number
  nochesVendidas: number
  adr: number
  revpar: number
  adrAyer: number
  pagosRecibidos: number
  pagosPendientes: number
  depositos: number
  reembolsos: number
}

export interface ReportDailyDTO {
  date: string
  value: number
}

export interface ReportsSummaryDTO {
  totalRevenue: number
  byChannel: Record<string, number>
  channelBookings: Record<string, number>
  channelADRs: Record<string, number>
  totalReservations: number
  canceledReservations: number
  dailyRevenue: ReportDailyDTO[]
  occupancyByType: { type: string; total: number; occupied: number; percentage: number }[]
  todayCheckins: number
  todayCheckouts: number
  topGuests: { name: string; stays: number; totalSpent: number }[]
}
