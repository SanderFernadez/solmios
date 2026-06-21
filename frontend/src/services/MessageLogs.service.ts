import { http } from './http'

export type MessageType = 'email' | 'whatsapp' | 'sms' | string
export type MessageStatus = 'pending' | 'sent' | 'failed' | 'queued' | string

export interface MessageLog {
  id: string
  hotelId?: string
  reservationId?: string
  messageId?: string
  messageType: MessageType
  status: MessageStatus
  recipient?: string
  response?: string
  sentAt?: string
  createdAt?: string
  /** Joined opcional desde el backend */
  guestName?: string
  subject?: string
  body?: string
}

export const MessageLogsService = {
  list: (params?: { reservationId?: string; status?: string; from?: string; to?: string }) => {
    const qs = new URLSearchParams()
    if (params?.reservationId) qs.set('reservationId', params.reservationId)
    if (params?.status) qs.set('status', params.status)
    if (params?.from) qs.set('from', params.from)
    if (params?.to) qs.set('to', params.to)
    const query = qs.toString()
    return http.get<{ data: MessageLog[] }>(`/message-logs${query ? `?${query}` : ''}`)
  },
}

export const MSG_STATUS_META: Record<string, { icon: string; label: string; class: string }> = {
  pending: { icon: '⏳', label: 'Pendiente', class: 'bg-gold/10 text-gold' },
  queued: { icon: '📬', label: 'En cola', class: 'bg-blue-100 text-blue-700' },
  sent: { icon: '✅', label: 'Enviado', class: 'bg-teal/10 text-teal' },
  failed: { icon: '❌', label: 'Fallido', class: 'bg-coral/10 text-coral' },
}

export function msgStatusMeta(status: string) {
  return MSG_STATUS_META[status] || { icon: '📨', label: status, class: 'bg-gray-100 text-gray-500' }
}

export const MSG_TYPE_META: Record<string, { icon: string; label: string }> = {
  email: { icon: '📧', label: 'Email' },
  whatsapp: { icon: '💬', label: 'WhatsApp' },
  sms: { icon: '📱', label: 'SMS' },
}

export function msgTypeMeta(type: string) {
  return MSG_TYPE_META[type] || { icon: '📨', label: type }
}
