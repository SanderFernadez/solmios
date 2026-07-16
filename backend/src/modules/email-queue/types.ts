// email-queue/types.ts — DTOs de la capa de OPERACIÓN sobre la cola de emails.
// El envío/reintento lo maneja EmailService (services/email-service.ts); este módulo
// solo LISTA y REENCOLA filas de la tabla `email_queue` para gestión manual.

export type EmailQueueStatus = 'pending' | 'processing' | 'sent' | 'failed'

export interface EmailQueueDTO {
  id: string
  hotelId: string
  /** Destinatario (columna 'recipient'; 'to' es palabra reservada de SQL). */
  recipient: string
  subject: string
  html: string
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

export interface EmailQueueQuery {
  hotelId?: string
  status?: EmailQueueStatus
  page?: number
  limit?: number
}

export interface EmailQueuePaginated {
  data: EmailQueueDTO[]
  total: number
  page?: number
  limit?: number
  pages?: number
}
