// gastos/types.ts — DTOs y tipos de queries (generado desde model.ts).
// Responsabilidad ÚNICA: contrato TypeScript del módulo. El schema de DB vive en ./model.ts.

export interface GastosDTO {
  id: string
  hotelId: string
  category?: string
  concept: string
  amount: number
  date?: string
  provider?: string
  invoiceNumber?: string
  notes?: string
  paid?: number
  createdAt: string
  updatedAt: string
}

export interface CreateGastosDTO {
  hotelId: string
  category?: string
  concept: string
  amount: number
  date?: string
  provider?: string
  invoiceNumber?: string
  notes?: string
  paid?: number
}

export interface UpdateGastosDTO {
  hotelId?: string
  category?: string
  concept?: string
  amount?: number
  date?: string
  provider?: string
  invoiceNumber?: string
  notes?: string
  paid?: number
}

// ─── Consultas ─────────────────────────────────────────
export interface GastosQuery {
  hotelId?: string
  status?: string
  type?: string
  category?: string
  search?: string
  page?: number
  limit?: number
}

export interface GastosPaginated {
  data: GastosDTO[]
  total: number
  limit: number
  offset: number
  pages: number
  hasNext: boolean
  hasPrev: boolean
}

// Usuario autenticado extraído del JWT (req.user). Se usa para verificar ownership (IDOR).
export interface CurrentUser {
  id: string
  hotelId?: string | null
  role?: string
}
