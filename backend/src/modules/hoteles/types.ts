// hoteles/types.ts — DTOs y tipos de queries (generado desde model.ts).
// Responsabilidad ÚNICA: contrato TypeScript del módulo. El schema de DB vive en ./model.ts.

export interface HotelesDTO {
  id: string
  name: string
  address?: string
  phone?: string
  email?: string
  country?: string
  currency?: string
  timezone?: string
  plan?: string
  status?: string
  roomsCount?: number
  active?: number
  createdAt: string
  updatedAt: string
}

export interface CreateHotelesDTO {
  name: string
  address?: string
  phone?: string
  email?: string
  country?: string
  currency?: string
  timezone?: string
  plan?: string
  status?: string
  roomsCount?: number
  active?: number
}

export interface UpdateHotelesDTO {
  name?: string
  address?: string
  phone?: string
  email?: string
  country?: string
  currency?: string
  timezone?: string
  plan?: string
  status?: string
  roomsCount?: number
  active?: number
}

// ─── Consultas ─────────────────────────────────────────
export interface HotelesQuery {
  hotelId?: string
  status?: string
  type?: string
  category?: string
  search?: string
  page?: number
  limit?: number
}

export interface HotelesPaginated {
  data: HotelesDTO[]
  total: number
}
