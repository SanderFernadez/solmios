// huespedes/types.ts — DTOs y tipos de queries (generado desde model.ts).
// Responsabilidad ÚNICA: contrato TypeScript del módulo. El schema de DB vive en ./model.ts.

export interface HuespedesDTO {
  id: string
  name: string
  email?: string
  phone?: string
  document?: string
  nationality?: string
  preferences?: any
  totalStays?: number
  totalSpent?: number
  tier?: string
  hotelId: string
  notes?: string
  active?: number
  createdAt: string
  updatedAt: string
}

export interface CreateHuespedesDTO {
  name: string
  email?: string
  phone?: string
  document?: string
  nationality?: string
  preferences?: any
  totalStays?: number
  totalSpent?: number
  tier?: string
  hotelId: string
  notes?: string
  active?: number
}

export interface UpdateHuespedesDTO {
  name?: string
  email?: string
  phone?: string
  document?: string
  nationality?: string
  preferences?: any
  totalStays?: number
  totalSpent?: number
  tier?: string
  hotelId?: string
  notes?: string
  active?: number
}

// ─── Consultas ─────────────────────────────────────────
export interface HuespedesQuery {
  hotelId?: string
  status?: string
  type?: string
  category?: string
  search?: string
  page?: number
  limit?: number
}

export interface HuespedesPaginated {
  data: HuespedesDTO[]
  total: number
}
