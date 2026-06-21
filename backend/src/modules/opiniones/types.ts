// opiniones/types.ts — DTOs y tipos de queries (generado desde model.ts).
// Responsabilidad ÚNICA: contrato TypeScript del módulo. El schema de DB vive en ./model.ts.

export interface OpinionesDTO {
  id: string
  hotelId: string
  guestId?: string
  reservationId?: string
  rating: number
  title?: string
  comment?: string
  response?: string
  date?: string
  visible?: number
  channel?: string
  createdAt: string
  updatedAt: string
}

export interface CreateOpinionesDTO {
  hotelId: string
  guestId?: string
  reservationId?: string
  rating: number
  title?: string
  comment?: string
  response?: string
  date?: string
  visible?: number
  channel?: string
}

export interface UpdateOpinionesDTO {
  hotelId?: string
  guestId?: string
  reservationId?: string
  rating?: number
  title?: string
  comment?: string
  response?: string
  date?: string
  visible?: number
  channel?: string
}

// ─── Consultas ─────────────────────────────────────────
export interface OpinionesQuery {
  hotelId?: string
  status?: string
  type?: string
  category?: string
  search?: string
  page?: number
  limit?: number
}

export interface OpinionesPaginated {
  data: OpinionesDTO[]
  total: number
}
