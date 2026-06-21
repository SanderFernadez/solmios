import { http } from './http'

interface List { data: any[]; total: number }

const makeCrud = (path: string) => ({
  list: (hotelId?: string) => http.get<List>(`/${path}${hotelId ? `?hotelId=${hotelId}` : ''}`),
  create: (data: any) => http.post(`/${path}`, data),
  update: (id: string, data: any) => http.put(`/${path}/${id}`, data),
  delete: (id: string, hotelId?: string) => http.delete(`/${path}/${id}${hotelId ? `?hotelId=${hotelId}` : ''}`),
})

export const OperationsService = {
  housekeeping: makeCrud('housekeeping'),
  mantenimiento: makeCrud('mantenimiento'),
  tickets: makeCrud('tickets'),
  grupos: makeCrud('grupos'),
  paquetes: (hotelId?: string) => http.get<List>(`/paquetes${hotelId ? `?hotelId=${hotelId}` : ''}`),
  dispositivos: (hotelId?: string) => http.get<List>(`/dispositivos${hotelId ? `?hotelId=${hotelId}` : ''}`),
  notificaciones: (hotelId?: string) => http.get<List>(`/notificaciones${hotelId ? `?hotelId=${hotelId}` : ''}`),
  planning: (hotelId?: string) => http.get<any>(`/planning${hotelId ? `?hotelId=${hotelId}` : ''}`),
  nightAudit: (hotelId?: string) => http.get<any>(`/night-audit${hotelId ? `?hotelId=${hotelId}` : ''}`),
  nightAuditRun: (hotelId?: string) => http.post<any>('/folios/audit/post-room-charges', { hotelId }),
  checkin: (hotelId?: string) => http.get<any>(`/checkin${hotelId ? `?hotelId=${hotelId}` : ''}`),
  bookingEngine: (hotelId?: string) => http.get<any>(`/booking-engine${hotelId ? `?hotelId=${hotelId}` : ''}`),
}
