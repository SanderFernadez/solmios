// dispositivos/types.ts — DTOs y tipos de queries (generado desde model.ts).
// Responsabilidad ÚNICA: contrato TypeScript del módulo. El schema de DB vive en ./model.ts.

export interface DispositivosDTO {
  id: string
  hotelId?: string
  userId?: string
  userName?: string
  device?: string
  icon?: string
  browser?: string
  os?: string
  ip?: string
  isMobile?: number
  lastActivity?: string
  createdAt: string
  updatedAt: string
}

export interface CreateDispositivosDTO {
  hotelId?: string
  userId?: string
  userName?: string
  device?: string
  icon?: string
  browser?: string
  os?: string
  ip?: string
  isMobile?: number
  lastActivity?: string
}

export interface UpdateDispositivosDTO {
  hotelId?: string
  userId?: string
  userName?: string
  device?: string
  icon?: string
  browser?: string
  os?: string
  ip?: string
  isMobile?: number
  lastActivity?: string
}

// ─── Consultas ─────────────────────────────────────────
export interface DispositivosQuery {
  hotelId?: string
  status?: string
  type?: string
  category?: string
  search?: string
  page?: number
  limit?: number
}

export interface DispositivosPaginated {
  data: DispositivosDTO[]
  total: number
}
