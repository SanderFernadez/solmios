import { http } from './http'

// Espeja backend/src/modules/email-queue.
// GET  /api/email-queue            → lista la cola (filtro por status + paginación, multi-tenant).
// POST /api/email-queue/:id/requeue → reencola un email fallido (el worker lo reintenta).

export type EmailQueueStatus = 'pending' | 'processing' | 'sent' | 'failed'

export interface EmailQueueItem {
  id: string
  hotelId: string
  recipient: string
  subject: string
  status: EmailQueueStatus
  attempts: number
  maxAttempts: number
  lastError?: string | null
  nextRetryAt?: string | null
  provider?: string | null
  relatedType?: string | null
  relatedId?: string | null
  createdAt?: string
  updatedAt?: string
}

export interface EmailQueuePage {
  data: EmailQueueItem[]
  total: number
  page?: number
  limit?: number
  pages?: number
}

export interface EmailQueueListParams {
  status?: EmailQueueStatus
  page?: number
  limit?: number
}

export const EmailQueueService = {
  list: (params?: EmailQueueListParams) => {
    const qs = new URLSearchParams()
    if (params?.status) qs.set('status', params.status)
    if (params?.page) qs.set('page', String(params.page))
    if (params?.limit) qs.set('limit', String(params.limit))
    const query = qs.toString()
    return http.get<EmailQueuePage>(`/email-queue${query ? `?${query}` : ''}`)
  },

  /** Reencola un email para que el worker lo reintente (status→pendiente, intentos→0). */
  requeue: (id: string) => http.post<EmailQueueItem>(`/email-queue/${id}/requeue`),
}

export const EMAIL_STATUS_META: Record<string, { label: string; class: string }> = {
  pending: { label: 'Pendiente', class: 'bg-gold/10 text-gold' },
  processing: { label: 'Procesando', class: 'bg-blue-100 text-blue-700' },
  sent: { label: 'Enviado', class: 'bg-teal/10 text-teal' },
  failed: { label: 'Fallido', class: 'bg-coral/10 text-coral' },
}

export function emailStatusMeta(status: string) {
  return EMAIL_STATUS_META[status] || { label: status, class: 'bg-gray-100 text-gray-500' }
}
