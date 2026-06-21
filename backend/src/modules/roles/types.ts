// roles/types.ts — DTOs y tipos de queries (generado desde model.ts).
// Responsabilidad ÚNICA: contrato TypeScript del módulo. El schema de DB vive en ./model.ts.

export interface RolesDTO {
  id: string
  name: string
  icon?: string
  color?: string
  system?: number
  hotelId?: string
  permissions?: any
  users?: number
  createdAt: string
  updatedAt: string
}

export interface CreateRolesDTO {
  name: string
  icon?: string
  color?: string
  system?: number
  hotelId?: string
  permissions?: any
  users?: number
}

export interface UpdateRolesDTO {
  name?: string
  icon?: string
  color?: string
  system?: number
  hotelId?: string
  permissions?: any
  users?: number
}

// ─── Consultas ─────────────────────────────────────────
export interface RolesQuery {
  hotelId?: string
  status?: string
  type?: string
  category?: string
  search?: string
  page?: number
  limit?: number
}

export interface RolesPaginated {
  data: RolesDTO[]
  total: number
}
