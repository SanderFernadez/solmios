// Un permiso es un string plano `modulo:accion` (ej: "reservations:view"), el MISMO formato que
// entiende hasPermission. Antes era un objeto {module, actions[]} que no matcheaba con el motor de
// permisos → guardar permisos no otorgaba acceso. Ver shared/usecases/parse-role-permissions.ts.
export type RolePermission = string

export interface RolesDTO {
  id: string
  name: string
  icon?: string
  color?: string
  system?: number
  hotelId?: string
  permissions?: RolePermission[]
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
  permissions?: RolePermission[]
  users?: number
}

export interface UpdateRolesDTO {
  name?: string
  icon?: string
  color?: string
  // NOTE: hotelId intentionally NOT here — cannot move role between hotels
  // NOTE: system NOT here — system roles cannot be modified
  permissions?: RolePermission[]
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
