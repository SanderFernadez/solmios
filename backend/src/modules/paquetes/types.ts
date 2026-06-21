// paquetes/types.ts — DTOs y tipos de queries (generado desde model.ts).
// Responsabilidad ÚNICA: contrato TypeScript del módulo. El schema de DB vive en ./model.ts.

export interface PaquetesDTO {
  id: string
  hotelId: string
  name: string
  description?: string
  type?: string
  price: number
  contents?: any
  active?: number
  createdAt: string
  updatedAt: string
}

export interface CreatePaquetesDTO {
  hotelId: string
  name: string
  description?: string
  type?: string
  price: number
  contents?: any
  active?: number
}

export interface UpdatePaquetesDTO {
  hotelId?: string
  name?: string
  description?: string
  type?: string
  price?: number
  contents?: any
  active?: number
}

// ─── Consultas ─────────────────────────────────────────
export interface PaquetesQuery {
  hotelId?: string
  status?: string
  type?: string
  category?: string
  search?: string
  page?: number
  limit?: number
}

export interface PaquetesPaginated {
  data: PaquetesDTO[]
  total: number
}
