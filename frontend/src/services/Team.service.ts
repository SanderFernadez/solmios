import { http } from './http'

export interface TeamMember {
  id: string
  name: string
  email: string
  role: 'super_admin' | 'hotel_admin' | 'receptionist' | string
  hotelId?: string
  hotelName?: string
  active?: boolean | number
  createdAt?: string
}

export interface Role {
  id?: string
  name: string
  icon?: string
  color?: string
  system?: boolean | number
  permissions?: string[]
  hotelId?: string
}

export const TeamService = {
  /** Lista miembros del equipo del hotel actual (filtrado server-side por hotelId del token) */
  list: () => http.get<{ data: TeamMember[]; total: number }>('/usuarios'),
  /** Lista roles disponibles del sistema */
  listRoles: () => http.get<{ data: Role[]; total: number }>('/roles'),
  /** Cambia el rol de un miembro */
  changeRole: (userId: string, role: string) =>
    http.put<TeamMember>(`/usuarios/${userId}`, { role }),
  /** Crea un nuevo miembro del equipo */
  create: (data: { name: string; email: string; role: string; hotelId: string; password?: string; phone?: string }) =>
    http.post<TeamMember>('/usuarios', data),
  /** Activa/desactiva un miembro (opcional — según backend) */
  update: (userId: string, patch: Partial<Pick<TeamMember, 'name' | 'email' | 'role'>>) =>
    http.put<TeamMember>(`/usuarios/${userId}`, patch),
  remove: (userId: string) => http.delete<{ success: boolean }>(`/usuarios/${userId}`),
}

/** Etiquetas legibles para roles del sistema */
export const ROLE_META: Record<string, { label: string; icon: string; class: string; description: string }> = {
  super_admin: { label: 'Super Admin', icon: '👑', class: 'bg-purple/10 text-purple', description: 'Acceso total a la plataforma' },
  hotel_admin: { label: 'Admin Hotel', icon: '🏨', class: 'bg-cyan/10 text-cyan', description: 'Gestiona su hotel: reservas, rooms, facturación, equipo' },
  receptionist: { label: 'Recepcionista', icon: '🛎️', class: 'bg-teal/10 text-teal', description: 'Reservas, check-in/out, huéspedes. No acceso a finanzas ni equipo' },
}

export function roleMeta(role: string) {
  return ROLE_META[role] || { label: role, icon: '👤', class: 'bg-gray-100 text-gray-600', description: '' }
}
