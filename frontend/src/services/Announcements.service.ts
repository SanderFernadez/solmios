import { http } from './http'

export type AnnouncementType = 'info' | 'success' | 'warning' | 'critical' | 'maintenance' | string
export type AnnouncementPriority = 'low' | 'medium' | 'high' | 'urgent'

export interface Announcement {
  id: string
  hotelId?: string
  authorId?: string
  title: string
  message?: string
  type: AnnouncementType
  priority: AnnouncementPriority
  active: boolean | number
  date?: string
  createdAt?: string
}

export const AnnouncementsService = {
  /** Lista anuncios activos (filtra por hotel del usuario o global) */
  list: (params?: { hotelId?: string; activeOnly?: boolean }) => {
    const qs = new URLSearchParams()
    if (params?.hotelId) qs.set('hotelId', params.hotelId)
    if (params?.activeOnly) qs.set('active', '1')
    const query = qs.toString()
    return http.get<{ data: Announcement[] }>(`/anuncios${query ? `?${query}` : ''}`)
  },
  create: (data: Omit<Announcement, 'id'>) => http.post<Announcement>('/anuncios', data),
  update: (id: string, data: Partial<Announcement>) => http.put<Announcement>(`/anuncios/${id}`, data),
  remove: (id: string) => http.delete<{ success: boolean }>(`/anuncios/${id}`),
}

export const ANNOUNCEMENT_META: Record<string, { icon: string; bgClass: string; textClass: string; borderClass: string }> = {
  info: { icon: 'ℹ️', bgClass: 'bg-blue-50', textClass: 'text-blue-800', borderClass: 'border-blue-200' },
  success: { icon: '✅', bgClass: 'bg-emerald-50', textClass: 'text-emerald-800', borderClass: 'border-emerald-200' },
  warning: { icon: '⚠️', bgClass: 'bg-amber-50', textClass: 'text-amber-800', borderClass: 'border-amber-200' },
  critical: { icon: '🚨', bgClass: 'bg-red-50', textClass: 'text-red-800', borderClass: 'border-red-200' },
  maintenance: { icon: '🔧', bgClass: 'bg-purple-50', textClass: 'text-purple-800', borderClass: 'border-purple-200' },
}

export function announcementMeta(type: string) {
  return ANNOUNCEMENT_META[type] || { icon: '📢', bgClass: 'bg-gray-50', textClass: 'text-gray-800', borderClass: 'border-gray-200' }
}
