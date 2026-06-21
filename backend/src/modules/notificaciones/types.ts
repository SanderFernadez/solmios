// notificaciones/types.ts — DTOs y tipos de queries (generado desde model.ts).
// Responsabilidad ÚNICA: contrato TypeScript del módulo. El schema de DB vive en ./model.ts.

export interface NotificacionesDTO {
  id: string
  hotelId: string
  userId?: string
  type?: string
  title: string
  message?: string
  read?: number
  sent?: number
  date?: string
  channel?: string
  metadata?: any
  createdAt: string
  updatedAt: string
}

export interface CreateNotificacionesDTO {
  hotelId: string
  userId?: string
  type?: string
  title: string
  message?: string
  read?: number
  sent?: number
  date?: string
  channel?: string
  metadata?: any
}

export interface UpdateNotificacionesDTO {
  hotelId?: string
  userId?: string
  type?: string
  title?: string
  message?: string
  read?: number
  sent?: number
  date?: string
  channel?: string
  metadata?: any
}

// ─── Consultas ─────────────────────────────────────────
export interface NotificacionesQuery {
  hotelId?: string
  status?: string
  type?: string
  category?: string
  search?: string
  page?: number
  limit?: number
}

export interface NotificacionesPaginated {
  data: NotificacionesDTO[]
  total: number
}
