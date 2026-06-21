// apikeys/types.ts — DTOs y tipos de queries (generado desde model.ts).
// Responsabilidad ÚNICA: contrato TypeScript del módulo. El schema de DB vive en ./model.ts.

export interface ApikeysDTO {
  id: string
  hotelId?: string
  name: string
  scope?: string
  masked?: string
  secretHash?: string
  active?: number
  requests?: number
  lastUsed?: string
  createdAt: string
  updatedAt: string
}

export interface CreateApikeysDTO {
  hotelId?: string
  name: string
  scope?: string
  masked?: string
  secretHash?: string
  active?: number
  requests?: number
  lastUsed?: string
}

export interface UpdateApikeysDTO {
  hotelId?: string
  name?: string
  scope?: string
  masked?: string
  secretHash?: string
  active?: number
  requests?: number
  lastUsed?: string
}

// ─── Consultas ─────────────────────────────────────────
export interface ApikeysQuery {
  hotelId?: string
  status?: string
  type?: string
  category?: string
  search?: string
  page?: number
  limit?: number
}

export interface ApikeysPaginated {
  data: ApikeysDTO[]
  total: number
}
