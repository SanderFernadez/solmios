export type PermissionAction = 'create' | 'read' | 'update' | 'delete'
export type PermissionModule = 'reservations' | 'rooms' | 'guests' | 'billing' | 'housekeeping' | 'maintenance' | 'reports' | 'settings' | 'users' | 'roles'

export interface Permission {
  module: PermissionModule
  actions: PermissionAction[]
}

export interface RolesDTO {
  id: string
  name: string
  icon?: string
  color?: string
  system?: number
  hotelId?: string
  permissions?: Permission[]
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
  permissions?: Permission[]
  users?: number
}

export interface UpdateRolesDTO {
  name?: string
  icon?: string
  color?: string
  // NOTE: hotelId intentionally NOT here — cannot move role between hotels
  // NOTE: system NOT here — system roles cannot be modified
  permissions?: Permission[]
}

export interface RolesQuery {
  hotelId?: string
  search?: string
  page?: number
  limit?: number
}

export interface RolesPaginated {
  data: RolesDTO[]
  total: number
  page?: number
  limit?: number
  pages?: number
}
