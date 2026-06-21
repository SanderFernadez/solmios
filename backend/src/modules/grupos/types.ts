// grupos/types.ts — DTOs y tipos de queries (generado desde model.ts).
// Responsabilidad ÚNICA: contrato TypeScript del módulo. El schema de DB vive en ./model.ts.

export interface GruposDTO {
  id: string
  hotelId: string
  name: string
  leadGuestId?: string
  totalRooms?: number
  checkIn?: string
  checkOut?: string
  status?: string
  totalAmount?: number
  notes?: string
  createdAt: string
  updatedAt: string
}

export interface CreateGruposDTO {
  hotelId: string
  name: string
  leadGuestId?: string
  totalRooms?: number
  checkIn?: string
  checkOut?: string
  status?: string
  totalAmount?: number
  notes?: string
}

export interface UpdateGruposDTO {
  hotelId?: string
  name?: string
  leadGuestId?: string
  totalRooms?: number
  checkIn?: string
  checkOut?: string
  status?: string
  totalAmount?: number
  notes?: string
}

// ─── Consultas ─────────────────────────────────────────
export interface GruposQuery {
  hotelId?: string
  status?: string
  type?: string
  category?: string
  search?: string
  page?: number
  limit?: number
}

export interface GruposPaginated {
  data: GruposDTO[]
  total: number
}
