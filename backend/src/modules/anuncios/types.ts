// anuncios/types.ts — DTOs y tipos de queries (generado desde model.ts).
// Responsabilidad ÚNICA: contrato TypeScript del módulo. El schema de DB vive en ./model.ts.

export interface AnunciosDTO {
  id: string
  hotelId?: string
  authorId?: string
  title: string
  message?: string
  type?: string
  priority?: string
  active?: number
  date?: string
  createdAt: string
  updatedAt: string
}

export interface CreateAnunciosDTO {
  hotelId?: string
  authorId?: string
  title: string
  message?: string
  type?: string
  priority?: string
  active?: number
  date?: string
}

export interface UpdateAnunciosDTO {
  hotelId?: string
  authorId?: string
  title?: string
  message?: string
  type?: string
  priority?: string
  active?: number
  date?: string
}

// ─── Consultas ─────────────────────────────────────────
export interface AnunciosQuery {
  hotelId?: string
  status?: string
  type?: string
  category?: string
  search?: string
  page?: number
  limit?: number
}

export interface AnunciosPaginated {
  data: AnunciosDTO[]
  total: number
}
