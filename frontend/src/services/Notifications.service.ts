import { http } from './http'

export type NotificationType = 'system' | 'reservation' | 'payment' | 'housekeeping' | 'maintenance' | 'review' | 'message' | string
export type NotificationChannel = 'in_app' | 'email' | 'whatsapp' | 'sms' | string

export interface AppNotification {
  id: string
  hotelId?: string
  userId?: string
  type: NotificationType
  title: string
  message?: string
  read: boolean
  sent: boolean
  date?: string
  channel?: NotificationChannel
  metadata?: Record<string, unknown>
  createdAt?: string
}

export interface NotificationList {
  data: AppNotification[]
  total: number
}

export interface NotificationStats {
  total: number
  unread: number
  byType: Record<string, number>
}

export const NotificationsService = {
  list: (params?: { hotelId?: string; userId?: string; unreadOnly?: boolean }) => {
    const qs = new URLSearchParams()
    if (params?.hotelId) qs.set('hotelId', params.hotelId)
    if (params?.userId) qs.set('userId', params.userId)
    if (params?.unreadOnly) qs.set('unread', '1')
    const query = qs.toString()
    return http.get<NotificationList>(`/notificaciones${query ? `?${query}` : ''}`)
  },

  create: (data: {
    hotelId?: string
    userId?: string
    type?: NotificationType
    title: string
    message?: string
    channel?: NotificationChannel
    metadata?: Record<string, unknown>
  }) => http.post<AppNotification>('/notificaciones', data),

  markAsRead: (id: string) => http.put<AppNotification>(`/notificaciones/${id}`, { read: 1 }),
  markAsUnread: (id: string) => http.put<AppNotification>(`/notificaciones/${id}`, { read: 0 }),
  remove: (id: string) => http.delete<{ success: boolean }>(`/notificaciones/${id}`),

  /** Marca todas las notificaciones del usuario/hotel como leídas (client-side bulk) */
  async markAllRead(params?: { hotelId?: string; userId?: string }): Promise<number> {
    const list = await NotificationsService.list(params)
    let count = 0
    for (const n of list.data) {
      if (!n.read) {
        try {
          await NotificationsService.markAsRead(n.id)
          count++
        } catch { /* silent */ }
      }
    }
    return count
  },

  /** Estadísticas calculadas en cliente */
  async stats(params?: { hotelId?: string; userId?: string }): Promise<NotificationStats> {
    const list = await NotificationsService.list(params)
    const data = list.data || []
    return {
      total: data.length,
      unread: data.filter(n => !n.read).length,
      byType: data.reduce((acc, n) => {
        acc[n.type] = (acc[n.type] || 0) + 1
        return acc
      }, {} as Record<string, number>),
    }
  },
}

/** Configuración visual por tipo de notificación */
export const NOTIF_META: Record<string, { icon: string; color: string; label: string }> = {
  system: { icon: '⚙️', color: 'bg-gray-100 text-gray-600', label: 'Sistema' },
  reservation: { icon: '📅', color: 'bg-cyan/10 text-cyan', label: 'Reserva' },
  payment: { icon: '💳', color: 'bg-teal/10 text-teal', label: 'Pago' },
  housekeeping: { icon: '🧹', color: 'bg-purple/10 text-purple', label: 'Limpieza' },
  maintenance: { icon: '🔧', color: 'bg-gold/10 text-gold', label: 'Mantenimiento' },
  review: { icon: '⭐', color: 'bg-coral/10 text-coral', label: 'Reseña' },
  message: { icon: '💬', color: 'bg-emerald-100 text-emerald-700', label: 'Mensaje' },
}

export function notifMeta(type: string) {
  return NOTIF_META[type] || { icon: '🔔', color: 'bg-gray-100 text-gray-600', label: type }
}
