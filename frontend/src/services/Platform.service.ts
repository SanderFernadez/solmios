import { http } from './http'

interface List { data: any[]; total: number }

export const PlatformService = {
  subscriptions: () => http.get<any>('/admin/subscriptions'),
  /** Auditoría — usa módulo /api/auditlog (unificado FC-A2) */
  audit: (params?: { hotelId?: string; page?: number; limit?: number }) => {
    const qs = new URLSearchParams()
    if (params?.hotelId) qs.set('hotelId', params.hotelId)
    if (params?.page) qs.set('page', String(params.page))
    if (params?.limit) qs.set('limit', String(params.limit))
    const query = qs.toString()
    return http.get<List>(`/auditlog${query ? `?${query}` : ''}`)
  },
  monitoring: () => http.get<any>('/admin/monitoring'),
  announcements: () => http.get<List>('/admin/announcements'),
  apiKeys: (hotelId?: string) => http.get<List>(`/api-keys${hotelId ? `?hotelId=${hotelId}` : ''}`),
  anuncios: () => http.get<List>('/anuncios'),
  users: (hotelId?: string) => http.get<List>(`/users${hotelId ? `?hotelId=${hotelId}` : ''}`),
}

import { http as _http } from './http'
export const ConfigService = {
  get: async (key: string, hotelId?: string): Promise<any> => {
    const q = hotelId ? `?hotelId=${hotelId}` : ''
    const r = await _http.get<{ valor: any }>(`/configuracion/${key}${q}`)
    return r.valor
  },
  set: async (key: string, value: any, hotelId?: string): Promise<void> => {
    await _http.post('/configuracion', { clave: key, valor: value, hotelId: hotelId || 'platform' })
  },
}
