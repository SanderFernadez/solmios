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

const SVG_OPEN = '<svg viewBox="0 0 24 24" class="w-full h-full" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">'
export const ICON_CLOCK = `${SVG_OPEN}<path d="M12 6v6l4 2"/><circle cx="12" cy="12" r="10"/></svg>`
export const ICON_INBOX = `${SVG_OPEN}<path d="M22 12h-6l-2 3h-4l-2-3H2"/><path d="M5.45 5.11 2 12v6a2 2 0 0 0 2 2h16a2 2 0 0 0 2-2v-6l-3.45-6.89A2 2 0 0 0 16.76 4H7.24a2 2 0 0 0-1.79 1.11Z"/></svg>`
export const ICON_CHECK = `${SVG_OPEN}<path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"/><path d="m9 11 3 3L22 4"/></svg>`
export const ICON_X_CIRCLE = `${SVG_OPEN}<circle cx="12" cy="12" r="10"/><path d="m15 9-6 6"/><path d="m9 9 6 6"/></svg>`
export const ICON_SEND = `${SVG_OPEN}<path d="m22 2-7 20-4-9-9-4Z"/><path d="M22 2 11 13"/></svg>`
export const ICON_MAIL = `${SVG_OPEN}<rect width="20" height="16" x="2" y="4" rx="2"/><path d="m22 7-8.97 5.7a1.94 1.94 0 0 1-2.06 0L2 7"/></svg>`
export const ICON_MESSAGE = `${SVG_OPEN}<path d="M7.9 20A9 9 0 1 0 4 16.1L2 22Z"/></svg>`
export const ICON_SMARTPHONE = `${SVG_OPEN}<rect width="14" height="20" x="5" y="2" rx="2" ry="2"/><path d="M12 18h.01"/></svg>`

export const MSG_STATUS_META: Record<string, { icon: string; label: string; class: string }> = {
  pending: { icon: ICON_CLOCK, label: 'Pendiente', class: 'bg-gold/10 text-gold' },
  queued: { icon: ICON_INBOX, label: 'En cola', class: 'bg-blue-100 text-blue-700' },
  sent: { icon: ICON_CHECK, label: 'Enviado', class: 'bg-teal/10 text-teal' },
  failed: { icon: ICON_X_CIRCLE, label: 'Fallido', class: 'bg-coral/10 text-coral' },
}

export function msgStatusMeta(status: string) {
  return MSG_STATUS_META[status] || { icon: ICON_SEND, label: status, class: 'bg-gray-100 text-gray-500' }
}

export const MSG_TYPE_META: Record<string, { icon: string; label: string }> = {
  email: { icon: ICON_MAIL, label: 'Email' },
  whatsapp: { icon: ICON_MESSAGE, label: 'WhatsApp' },
  sms: { icon: ICON_SMARTPHONE, label: 'SMS' },
}

export function msgTypeMeta(type: string) {
  return MSG_TYPE_META[type] || { icon: ICON_SEND, label: type }
}
