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

const NI = (path: string) => `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.75" class="w-full h-full"><path stroke-linecap="round" stroke-linejoin="round" d="${path}"/></svg>`

const ICON_SYSTEM = `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.75" class="w-full h-full"><path stroke-linecap="round" stroke-linejoin="round" d="M9.594 3.94c.09-.542.56-.94 1.11-.94h2.593c.55 0 1.02.398 1.11.94l.213 1.281c.063.374.313.686.645.87.074.04.147.083.22.127.324.196.72.257 1.075.124l1.217-.456a1.125 1.125 0 011.37.49l1.296 2.247a1.125 1.125 0 01-.26 1.431l-1.003.827c-.293.24-.438.613-.431.992a6.759 6.759 0 010 .255c-.007.378.138.75.43.992l1.005.828c.424.35.534.954.26 1.43l-1.298 2.247a1.125 1.125 0 01-1.369.491l-1.217-.456c-.355-.133-.75-.072-1.076.124a6.57 6.57 0 01-.22.128c-.331.183-.581.495-.644.869l-.213 1.28c-.09.543-.56.941-1.11.941h-2.594c-.55 0-1.019-.398-1.11-.94l-.213-1.281c-.062-.374-.312-.686-.644-.87a6.52 6.52 0 01-.22-.127c-.325-.196-.72-.257-1.076-.124l-1.217.456a1.125 1.125 0 01-1.369-.49l-1.297-2.247a1.125 1.125 0 01.26-1.431l1.004-.827c.292-.24.437-.613.43-.992a6.932 6.932 0 010-.255c.007-.378-.138-.75-.43-.992l-1.004-.828a1.125 1.125 0 01-.26-1.43l1.297-2.247a1.125 1.125 0 011.37-.491l1.216.456c.356.133.751.072 1.076-.124.072-.044.146-.086.22-.128.332-.183.582-.495.644-.869l.214-1.281z"/><path stroke-linecap="round" stroke-linejoin="round" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z"/></svg>`

/** Configuración visual por tipo de notificación */
export const NOTIF_META: Record<string, { icon: string; color: string; label: string }> = {
  system: { icon: ICON_SYSTEM, color: 'bg-gray-100 text-gray-600', label: 'Sistema' },
  reservation: { icon: NI('M6.75 3v2.25M17.25 3v2.25M3 18.75V7.5a2.25 2.25 0 012.25-2.25h13.5A2.25 2.25 0 0121 7.5v11.25m-18 0A2.25 2.25 0 005.25 21h13.5A2.25 2.25 0 0021 18.75m-18 0v-7.5A2.25 2.25 0 015.25 9h13.5A2.25 2.25 0 0121 11.25v7.5'), color: 'bg-cyan/10 text-cyan', label: 'Reserva' },
  payment: { icon: NI('M2.25 8.25h19.5M2.25 9h19.5m-16.5 5.25h6m-6 2.25h3m-3.75 3h15a1.5 1.5 0 001.5-1.5V6a1.5 1.5 0 00-1.5-1.5h-15A1.5 1.5 0 002.25 6v12a1.5 1.5 0 001.5 1.5z'), color: 'bg-teal/10 text-teal', label: 'Pago' },
  housekeeping: { icon: NI('M9.813 15.904L9 18.75l-.813-2.846a4.5 4.5 0 00-3.09-3.09L2.25 12l2.846-.813a4.5 4.5 0 003.09-3.09L9 5.25l.813 2.846a4.5 4.5 0 003.09 3.09L15.75 12l-2.846.813a4.5 4.5 0 00-3.09 3.09zM18.259 8.715L18 9.75l-.259-1.035a3.375 3.375 0 00-2.455-2.456L14.25 6l1.036-.259a3.375 3.375 0 002.455-2.456L18 2.25l.259 1.035a3.375 3.375 0 002.456 2.456L21.75 6l-1.035.259a3.375 3.375 0 00-2.456 2.456z'), color: 'bg-purple/10 text-purple', label: 'Limpieza' },
  maintenance: { icon: NI('M11.42 15.17L17.25 21A2.652 2.652 0 0021 17.25l-5.877-5.877M11.42 15.17l2.496-3.03c.317-.384.74-.626 1.208-.766M11.42 15.17l-4.655 5.653a2.548 2.548 0 11-3.586-3.586l6.837-5.63m5.108-.233c.55-.164 1.163-.188 1.743-.14a4.5 4.5 0 004.486-6.336l-3.276 3.277a3.004 3.004 0 01-2.25-2.25l3.276-3.276a4.5 4.5 0 00-6.336 4.486c.091 1.076-.071 2.264-.904 2.95l-.102.085'), color: 'bg-gold/10 text-gold', label: 'Mantenimiento' },
  review: { icon: NI('M11.48 3.499a.562.562 0 011.04 0l2.125 5.111a.563.563 0 00.475.345l5.518.442c.499.04.701.663.321.988l-4.204 3.602a.563.563 0 00-.182.557l1.285 5.385a.562.562 0 01-.84.61l-4.725-2.885a.562.562 0 00-.586 0L6.982 20.54a.562.562 0 01-.84-.61l1.285-5.386a.562.562 0 00-.182-.557l-4.204-3.602a.563.563 0 01.321-.988l5.518-.442a.563.563 0 00.475-.345L11.48 3.5z'), color: 'bg-coral/10 text-coral', label: 'Reseña' },
  message: { icon: NI('M20.25 8.511c.884.284 1.5 1.128 1.5 2.097v4.286c0 1.136-.847 2.1-1.98 2.193-.34.027-.68.052-1.02.072v3.091l-3-3c-1.354 0-2.694-.055-4.02-.163a2.115 2.115 0 01-.825-.242m9.345-8.334a2.126 2.126 0 00-.476-.095 48.64 48.64 0 00-8.048 0c-1.131.094-1.976 1.057-1.976 2.192v4.286c0 .837.46 1.58 1.155 1.951m9.345-8.334V6.637c0-1.621-1.152-3.026-2.76-3.235A48.455 48.455 0 0011.25 3c-2.115 0-4.198.137-6.24.402-1.608.209-2.76 1.614-2.76 3.235v6.226c0 1.621 1.152 3.026 2.76 3.235.577.075 1.157.14 1.74.194V21l4.155-4.155'), color: 'bg-emerald-100 text-emerald-700', label: 'Mensaje' },
}

export function notifMeta(type: string) {
  return NOTIF_META[type] || { icon: NI('M14.857 17.082a23.848 23.848 0 005.454-1.31A8.967 8.967 0 0118 9.75v-.7V9A6 6 0 006 9v.75a8.967 8.967 0 01-2.312 6.022c1.733.64 3.56 1.085 5.455 1.31m5.714 0a24.255 24.255 0 01-5.714 0m5.714 0a3 3 0 11-5.714 0'), color: 'bg-gray-100 text-gray-600', label: type }
}
