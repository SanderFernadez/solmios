/**
 * Permission system for hotel-level roles
 * Each hotel can create custom roles with specific permissions
 */

// Available modules in the system
export const MODULES = {
  dashboard: 'Dashboard',
  reservations: 'Reservaciones',
  guests: 'Huéspedes',
  rooms: 'Habitaciones',
  housekeeping: 'Housekeeping',
  maintenance: 'Mantenimiento',
  billing: 'Facturación',
  reports: 'Reportes',
  settings: 'Configuración',
  users: 'Usuarios',
  feedback: 'Feedback',
  'channel-manager': 'Channel Manager',
  ttlock: 'Cerraduras',
  ai: 'Inteligencia Artificial',
} as const

// Available actions per module
export const ACTIONS = {
  view: 'Ver',
  create: 'Crear',
  edit: 'Editar',
  delete: 'Eliminar',
  export: 'Exportar',
  checkin: 'Check-in',
  checkout: 'Check-out',
} as const

// Permission format: "module:action" (e.g., "reservations:view", "billing:edit")
export type Permission = string

// Default permissions for system roles
export const DEFAULT_ROLE_PERMISSIONS: Record<string, Permission[]> = {
  // Hotel Admin - full access to everything
  // El dueño del hotel administra TODO su hotel. Le faltaban los `:delete` de billing/housekeeping/
  // maintenance y los `:create/:edit/:delete` de dashboard (anuncios, notificaciones), reports
  // (opiniones, tickets, night-audit) y settings (dispositivos, api keys, auto-mensajes, bloqueos de
  // tarifa): 32 endpoints eran inalcanzables para él, incluido borrar una factura o un gasto.
  //
  // Alta/baja de HOTELES no está acá: es operación de plataforma (`hotels:*`, solo super_admin).
  hotel_admin: [
    'dashboard:view', 'dashboard:create', 'dashboard:edit', 'dashboard:delete',
    'reservations:view', 'reservations:create', 'reservations:edit', 'reservations:delete', 'reservations:checkin', 'reservations:checkout',
    'guests:view', 'guests:create', 'guests:edit', 'guests:delete',
    'rooms:view', 'rooms:create', 'rooms:edit', 'rooms:delete',
    'housekeeping:view', 'housekeeping:create', 'housekeeping:edit', 'housekeeping:delete',
    'maintenance:view', 'maintenance:create', 'maintenance:edit', 'maintenance:delete',
    'billing:view', 'billing:create', 'billing:edit', 'billing:delete',
    'reports:view', 'reports:export', 'reports:create', 'reports:edit', 'reports:delete',
    'settings:view', 'settings:edit', 'settings:create', 'settings:delete',
    'users:view', 'users:create', 'users:edit', 'users:delete',
    'feedback:view',
    'channel-manager:view', 'channel-manager:edit',
    'ttlock:view', 'ttlock:edit',
    'ai:view', 'ai:edit',
  ],

  // Receptionist - day-to-day operations
  receptionist: [
    'dashboard:view',
    'reservations:view', 'reservations:create', 'reservations:edit', 'reservations:checkin', 'reservations:checkout',
    'guests:view', 'guests:create', 'guests:edit',
    'rooms:view',
    'housekeeping:view',
    'maintenance:view',
    'reports:view',
    'ttlock:view',
    'ai:view',
  ],

  // Housekeeper - cleaning tasks only
  housekeeper: [
    'rooms:view',
    'housekeeping:view', 'housekeeping:edit',
  ],

  // Supervisor - approve housekeeping, view rooms
  supervisor: [
    'dashboard:view',
    'rooms:view',
    'housekeeping:view', 'housekeeping:edit',
  ],

  // Maintenance - maintenance tasks only
  maintenance: [
    'rooms:view',
    'maintenance:view', 'maintenance:edit',
  ],
}

/**
 * Check if a user has a specific permission
 * @param userPermissions - Array of permissions from the user's role
 * @param module - Module name (e.g., 'reservations')
 * @param action - Action name (e.g., 'view')
 * @returns true if the user has the permission
 */
export function hasPermission(userPermissions: Permission[], module: string, action: string): boolean {
  if (!userPermissions || !Array.isArray(userPermissions)) return false
  const required = `${module}:${action}`
  // `*:*` lo asigna loadPermissions a super_admin. require-permission ya lo deja pasar antes de
  // llegar acá, pero reconocerlo evita que el bypass sea el único punto que sostiene el acceso total.
  return userPermissions.includes('*:*') ||
    userPermissions.includes(required) ||
    userPermissions.includes(`${module}:*`)
}

/**
 * Check if a user has any permission for a module
 * @param userPermissions - Array of permissions from the user's role
 * @param module - Module name
 * @returns true if the user has any permission for the module
 */
export function hasModuleAccess(userPermissions: Permission[], module: string): boolean {
  if (!userPermissions || !Array.isArray(userPermissions)) return false
  return userPermissions.some(p => p.startsWith(`${module}:`))
}

/**
 * Get all permissions for a role
 * @param roleName - Role name (e.g., 'hotel_admin')
 * @param customPermissions - Custom permissions from the role record (overrides defaults)
 * @returns Array of permissions
 */
/**
 * Un permiso válido es `modulo:accion` (o `modulo:*`, o `*:*`). La tabla `roles` de instalaciones
 * viejas guarda otro formato (`billing.read`, con punto). `hasPermission` solo entiende dos puntos,
 * así que devolver esos permisos tal cual dejaría al usuario SIN ACCESO A NADA — y en silencio.
 */
const isValidPermission = (p: unknown): p is Permission => typeof p === 'string' && p.includes(':')

export function getRolePermissions(roleName: string, customPermissions?: Permission[]): Permission[] {
  const custom = Array.isArray(customPermissions) ? customPermissions.filter(isValidPermission) : []
  // Solo pisamos los defaults si la DB trae permisos que el sistema sabe evaluar. Una fila con el
  // formato viejo (o corrupta) cae al mapa estático en vez de bloquear al usuario.
  if (custom.length > 0) return custom
  return DEFAULT_ROLE_PERMISSIONS[roleName] || []
}
