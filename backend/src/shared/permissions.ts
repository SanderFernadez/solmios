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
  hotel_admin: [
    'dashboard:view',
    'reservations:view', 'reservations:create', 'reservations:edit', 'reservations:delete', 'reservations:checkin', 'reservations:checkout',
    'guests:view', 'guests:create', 'guests:edit', 'guests:delete',
    'rooms:view', 'rooms:create', 'rooms:edit', 'rooms:delete',
    'housekeeping:view', 'housekeeping:create', 'housekeeping:edit',
    'maintenance:view', 'maintenance:create', 'maintenance:edit',
    'billing:view', 'billing:create', 'billing:edit',
    'reports:view', 'reports:export',
    'settings:view', 'settings:edit',
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
  return userPermissions.includes(required) || userPermissions.includes(`${module}:*`)
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
export function getRolePermissions(roleName: string, customPermissions?: Permission[]): Permission[] {
  if (customPermissions && customPermissions.length > 0) {
    return customPermissions
  }
  return DEFAULT_ROLE_PERMISSIONS[roleName] || []
}
