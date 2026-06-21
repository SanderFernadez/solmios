// reservas/types.ts — DTOs y tipos de queries (generado desde model.ts).
// Responsabilidad ÚNICA: contrato TypeScript del módulo. El schema de DB vive en ./model.ts.

export interface ReservasDTO {
  id: string
  guestId?: string
  roomId: string
  hotelId: string
  checkIn: string
  checkOut: string
  status?: string
  channel?: string
  totalAmount: number
  deposit?: number
  currency?: string
  adults?: number
  children?: number
  notes?: string
  createdAt: string
  updatedAt: string
}

export interface CreateReservasDTO {
  guestId?: string
  roomId: string
  hotelId: string
  checkIn: string
  checkOut: string
  status?: string
  channel?: string
  totalAmount: number
  deposit?: number
  currency?: string
  adults?: number
  children?: number
  notes?: string
}

export interface UpdateReservasDTO {
  guestId?: string
  roomId?: string
  hotelId?: string
  checkIn?: string
  checkOut?: string
  status?: string
  channel?: string
  totalAmount?: number
  deposit?: number
  currency?: string
  adults?: number
  children?: number
  notes?: string
}

// ─── Consultas ─────────────────────────────────────────
export interface ReservasQuery {
  hotelId?: string
  status?: string
  type?: string
  category?: string
  search?: string
  page?: number
  limit?: number
}

export interface ReservasPaginated {
  data: ReservasDTO[]
  total: number
}
