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

const SVG_OPEN = '<svg viewBox="0 0 24 24" class="w-full h-full" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">'
export const ICON_CROWN = `${SVG_OPEN}<path d="m2.5 20 3-15 5 6 3.5-7 3.5 7 5-6 3 15Z"/><path d="M4 20h16"/></svg>`
export const ICON_BUILDING = `${SVG_OPEN}<path d="M6 22V4a2 2 0 0 1 2-2h8a2 2 0 0 1 2 2v18Z"/><path d="M6 12H4a2 2 0 0 0-2 2v6a2 2 0 0 0 2 2h2"/><path d="M18 9h2a2 2 0 0 1 2 2v9a2 2 0 0 1-2 2h-2"/><path d="M10 6h4"/><path d="M10 10h4"/><path d="M10 14h4"/><path d="M10 18h4"/></svg>`
export const ICON_BELL = `${SVG_OPEN}<path d="M3 20a1 1 0 0 1-1-1v-1a2 2 0 0 1 2-2h16a2 2 0 0 1 2 2v1a1 1 0 0 1-1 1Z"/><path d="M20 16a8 8 0 0 0-16 0"/><path d="M12 4v4"/><path d="M10 4h4"/></svg>`
export const ICON_USER = `${SVG_OPEN}<path d="M19 21v-2a4 4 0 0 0-4-4H9a4 4 0 0 0-4 4v2"/><circle cx="12" cy="7" r="4"/></svg>`

/** Etiquetas legibles para roles del sistema */
export const ROLE_META: Record<string, { label: string; icon: string; class: string; description: string }> = {
  super_admin: { label: 'Super Admin', icon: ICON_CROWN, class: 'bg-purple/10 text-purple', description: 'Acceso total a la plataforma' },
  hotel_admin: { label: 'Admin Hotel', icon: ICON_BUILDING, class: 'bg-cyan/10 text-cyan', description: 'Gestiona su hotel: reservas, rooms, facturación, equipo' },
  receptionist: { label: 'Recepcionista', icon: ICON_BELL, class: 'bg-teal/10 text-teal', description: 'Reservas, check-in/out, huéspedes. No acceso a finanzas ni equipo' },
}

export function roleMeta(role: string) {
  return ROLE_META[role] || { label: role, icon: ICON_USER, class: 'bg-gray-100 text-gray-600', description: '' }
}
