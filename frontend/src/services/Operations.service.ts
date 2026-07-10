import { http } from './http'

interface List { data: any[]; total: number }

const makeCrud = (path: string) => ({
  list: (hotelId?: string) => http.get<List>(`/${path}${hotelId ? `?hotelId=${hotelId}` : ''}`),
  create: (data: any) => http.post(`/${path}`, data),
  update: (id: string, data: any) => http.put(`/${path}/${id}`, data),
  delete: (id: string, hotelId?: string) => http.delete(`/${path}/${id}${hotelId ? `?hotelId=${hotelId}` : ''}`),
  post: (idPath: string, data: any) => http.post(`/${path}/${idPath}`, data),
  put: (idPath: string, data: any) => http.put(`/${path}/${idPath}`, data),
  get: (idPath: string) => http.get(`/${path}/${idPath}`),
})

export const OperationsService = {
  mantenimiento: makeCrud('mantenimiento'),
  tickets: makeCrud('tickets'),
  grupos: makeCrud('grupos'),
  dispositivos: (hotelId?: string) => http.get<List>(`/dispositivos${hotelId ? `?hotelId=${hotelId}` : ''}`),
  planning: (hotelId?: string) => http.get<any>(`/planning${hotelId ? `?hotelId=${hotelId}` : ''}`),
  nightAudit: (hotelId?: string) => http.get<any>(`/night-audit${hotelId ? `?hotelId=${hotelId}` : ''}`),
  nightAuditRun: (hotelId?: string) => http.post<any>('/folios/audit/post-room-charges', { hotelId }),
}
