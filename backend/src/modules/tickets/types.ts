// tickets/types.ts — DTOs y tipos de queries (generado desde model.ts).
// Responsabilidad ÚNICA: contrato TypeScript del módulo. El schema de DB vive en ./model.ts.

export interface TicketsDTO {
  id: string
  hotelId: string
  userId: string
  subject: string
  category?: string
  priority?: string
  status?: string
  description?: string
  assignedTo?: string
  messages?: any
  createdAt: string
  updatedAt: string
}

export interface CreateTicketsDTO {
  hotelId: string
  userId: string
  subject: string
  category?: string
  priority?: string
  status?: string
  description?: string
  assignedTo?: string
  messages?: any
}

export interface UpdateTicketsDTO {
  hotelId?: string
  userId?: string
  subject?: string
  category?: string
  priority?: string
  status?: string
  description?: string
  assignedTo?: string
  messages?: any
}

// ─── Consultas ─────────────────────────────────────────
export interface TicketsQuery {
  hotelId?: string
  status?: string
  type?: string
  category?: string
  search?: string
  page?: number
  limit?: number
}

export interface TicketsPaginated {
  data: TicketsDTO[]
  total: number
}
