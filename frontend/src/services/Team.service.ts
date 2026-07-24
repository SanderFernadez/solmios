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
export const ICON_BROOM = `${SVG_OPEN}<path d="m13 11 9-9"/><path d="M14.6 12.6 11.4 9.4"/><path d="M6 22a4 4 0 0 1-4-4c2 0 3-1 3-3l6 6c0 2-1 3-3 3Z"/><path d="M9.5 6.5 17 14"/></svg>`
export const ICON_WRENCH = `${SVG_OPEN}<path d="M14.7 6.3a1 1 0 0 0 0 1.4l1.6 1.6a1 1 0 0 0 1.4 0l3.77-3.77a6 6 0 0 1-7.94 7.94l-6.91 6.91a2.12 2.12 0 0 1-3-3l6.91-6.91a6 6 0 0 1 7.94-7.94l-3.76 3.76Z"/></svg>`
export const ICON_CLIPBOARD = `${SVG_OPEN}<path d="M16 4h2a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2h2"/><rect width="8" height="4" x="8" y="2" rx="1"/><path d="m9 14 2 2 4-4"/></svg>`
export const ICON_UTENSILS = `${SVG_OPEN}<path d="M5 3v7a2 2 0 0 0 2 2v9M9 3v7M7 3v7M18 3c-1.5 0-3 1.5-3 5s1.5 4 3 4v9"/></svg>`
export const ICON_CHEF_HAT = `${SVG_OPEN}<path d="M6 13.87A4 4 0 0 1 7.41 6a5.11 5.11 0 0 1 1.05-1.54 5 5 0 0 1 7.08 0A5.11 5.11 0 0 1 16.59 6 4 4 0 0 1 18 13.87V21H6Z"/><path d="M6 17h12"/></svg>`

/**
 * Etiquetas legibles para roles del sistema.
 * DEBE cubrir los 5 roles que define el backend en `shared/permissions.ts`
 * (hotel_admin, receptionist, housekeeper, maintenance, supervisor) + super_admin.
 * Si falta uno, `roleMeta()` cae al fallback y la UI muestra el slug crudo en inglés.
 */
export const ROLE_META: Record<string, { label: string; icon: string; class: string; description: string }> = {
  super_admin: { label: 'Super Admin', icon: ICON_CROWN, class: 'bg-purple/10 text-purple', description: 'Acceso total a la plataforma' },
  hotel_admin: { label: 'Admin Hotel', icon: ICON_BUILDING, class: 'bg-cyan/10 text-cyan', description: 'Gestiona su hotel: reservas, rooms, facturación, equipo' },
  receptionist: { label: 'Recepcionista', icon: ICON_BELL, class: 'bg-teal/10 text-teal', description: 'Reservas, check-in/out, huéspedes. No acceso a finanzas ni equipo' },
  housekeeper: { label: 'Limpieza', icon: ICON_BROOM, class: 'bg-teal-light/10 text-teal-light', description: 'Tareas de limpieza de habitaciones desde la app móvil' },
  maintenance: { label: 'Mantenimiento', icon: ICON_WRENCH, class: 'bg-gold/10 text-gold', description: 'Tickets de mantenimiento y reparaciones' },
  supervisor: { label: 'Supervisor', icon: ICON_CLIPBOARD, class: 'bg-navy/10 text-navy', description: 'Supervisa y aprueba las tareas de limpieza del personal' },
  waiter: { label: 'Mesero', icon: ICON_UTENSILS, class: 'bg-blue/10 text-blue', description: 'Salón del restaurante: abre comandas, las envía a cocina y cobra' },
  kitchen: { label: 'Cocina', icon: ICON_CHEF_HAT, class: 'bg-coral/10 text-coral', description: 'KDS del restaurante: ve la cola de pedidos y marca su estado' },
}

/** Rol sin valor (usuarios legacy insertados fuera de la API): se muestra explícito, nunca vacío. */
const ROLE_UNSET = { label: 'Sin rol', icon: ICON_USER, class: 'bg-surface-dark text-text-muted', description: 'El usuario no tiene rol asignado' }

export function roleMeta(role?: string | null) {
  if (!role) return ROLE_UNSET
  return ROLE_META[role] || { label: role, icon: ICON_USER, class: 'bg-surface-dark text-text-secondary', description: '' }
}
