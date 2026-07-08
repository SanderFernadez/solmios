import { http } from './http'

export type ReportType = 'facturacion' | 'ocupacion' | 'pernoctaciones' | 'rendimiento' | 'procedencia' | 'reservas'

export interface ReportParams {
  from?: string
  to?: string
}

export interface FacturacionReport {
  type: string; from: string; to: string
  roomRevenue: number
  extrasRevenue: number
  extrasByCategory: Record<string, number>
  taxes: number
  commissionOTA: number
  total: number
  net: number
  daily: Array<{ date: string; value: number }>
}

export interface OcupacionReport {
  type: string; from: string; to: string
  totalRooms: number
  avgRealOccupancy: number
  daily: Array<{ date: string; occupied: number; blocked: number; free: number; realOccupiedPct: number; totalPct: number }>
  byRoomType: Record<string, number>
}

export interface PernotacionesReport {
  type: string; from: string; to: string
  totalPaxes: number
  totalAdults: number
  totalChildren: number
  avgPerNight: number
  daily: Array<{ date: string; adults: number; children: number; total: number; reservations: number }>
}

export interface RendimientoReport {
  type: string; from: string; to: string
  adr: number
  revpar: number
  occupancyPct: number
  avgStay: number
  nightsSold: number
  availableRoomNights: number
  adrByType: Record<string, { nights: number; revenue: number; adr: number }>
  revenueByType: Record<string, number>
}

export interface ProcedenciaReport {
  type: string; from: string; to: string
  byCountry: Array<{ country: string; guests: number; revenue: number }>
  byChannel: Array<{ channel: string; count: number; revenue: number }>
}

export interface ReservasReport {
  type: string; from: string; to: string
  total: number
  byStatus: Record<string, number>
  byChannel: Record<string, number>
  otaVsDirect: { ota: number; direct: number; otaPct: number; directPct: number }
  cancelled: number
  noShow: number
  cancellationRate: number
  dailyCreated: Array<{ date: string; value: number }>
}

export type AnyReport = FacturacionReport | OcupacionReport | PernotacionesReport | RendimientoReport | ProcedenciaReport | ReservasReport

export const ReportsService = {
  get: <T extends AnyReport>(type: ReportType, params?: ReportParams) =>
    http.get<T>(`/reports/advanced?type=${type}${params?.from ? `&from=${params.from}` : ''}${params?.to ? `&to=${params.to}` : ''}`),

  exportUrl: (type: ReportType, params?: ReportParams) =>
    `/api/reports/export?type=${type}${params?.from ? `&from=${params.from}` : ''}${params?.to ? `&to=${params.to}` : ''}`,

  /** Dispara descarga CSV */
  async exportCsv(type: ReportType, params?: ReportParams) {
    const url = ReportsService.exportUrl(type, params)
    const token = localStorage.getItem('token')
    const res = await fetch(url, { headers: token ? { Authorization: `Bearer ${token}` } : {} })
    if (!res.ok) throw new Error('Error al exportar')
    const blob = await res.blob()
    const a = document.createElement('a')
    a.href = URL.createObjectURL(blob)
    a.download = `reporte-${type}-${new Date().toISOString().slice(0, 10)}.csv`
    a.click()
    URL.revokeObjectURL(a.href)
  },
}

export const REPORT_META: Record<ReportType, { label: string; icon: string; description: string }> = {
  facturacion: { label: 'Facturación', icon: 'wallet', description: 'Ingresos por habitación, extras, impuestos y comisiones OTA' },
  ocupacion: { label: 'Ocupación', icon: 'chart', description: 'Diaria, real (sin bloqueos), libres vs ocupadas' },
  pernoctaciones: { label: 'Pernoctaciones', icon: 'bed', description: 'Personas por noche, total y desglose' },
  rendimiento: { label: 'Rendimiento', icon: 'trending', description: 'ADR por tipo, RevPAR, estancia media' },
  procedencia: { label: 'Procedencia', icon: 'globe', description: 'Por país del huésped y por canal' },
  reservas: { label: 'Reservas', icon: 'calendar', description: 'Por canal (OTA vs directo), estados, cancelaciones' },
}
