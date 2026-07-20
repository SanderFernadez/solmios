// Fuente ÚNICA ruta del panel → clave de módulo/submódulo del catálogo (backend admin/usecases/modules.ts).
// La usan el menú del hotel (AdminLayout) y el guard de rutas (router) para decidir qué se ve y a qué se
// puede entrar. Lo NO mapeado es CORE: siempre accesible (Dashboard, Configuración Base, Soporte,
// Notificaciones, Booking Engine). Así el hotel nunca queda sin acceso mínimo.

export const ROUTE_TO_KEY: Record<string, string> = {
  '/panel/planning': 'planning',
  '/panel/channel-manager': 'channel',
  '/panel/channel': 'channel',                       // detalle /panel/channel/:id
  '/panel/reservas': 'reservations.list',
  '/panel/reservas/checkin': 'reservations.checkin',
  '/panel/guests': 'guests',
  '/panel/operaciones/limpieza': 'operations.housekeeping',
  '/panel/operaciones/mantenimiento': 'operations.maintenance',
  '/panel/operaciones/proveedores': 'operations.providers',
  '/panel/operaciones/chats': 'operations.team-chat',
  '/panel/finanzas/facturacion': 'finance.billing',
  '/panel/finanzas/folios': 'finance.folios',
  '/panel/finanzas/links-pago': 'finance.payments',
  '/panel/finanzas/caja': 'finance.caja',
  '/panel/finanzas/gastos': 'finance.gastos',
  '/panel/finanzas/reportes': 'finance.reports',
  '/panel/finanzas/night-audit': 'finance.night-audit',
  '/panel/ventas/grupos': 'sales.groups',
  '/panel/ventas/promociones': 'sales.packages',
  '/panel/ventas/opiniones': 'sales.reviews',
  '/panel/ia/recepcionista': 'ai.receptionist',       // incluye /panel/ia/recepcionista/config (prefijo)
  '/panel/ia/gerente': 'ai.manager',
  '/panel/crm': 'crm',
  '/panel/rrhh/dashboard': 'hr.dashboard',
  '/panel/rrhh/empleados': 'hr.employees',
  '/panel/rrhh/evaluacion': 'hr.evaluacion',
  '/panel/rrhh/attendance': 'hr.attendance',
  '/panel/rrhh/payroll': 'hr.payroll',
  '/panel/rrhh/reclutamiento': 'hr.reclutamiento',
  '/panel/rrhh/reembolsos': 'hr.reembolsos',
  '/panel/rrhh/organigrama': 'hr.organigrama',
  '/panel/rrhh/team': 'hr.team',
  '/panel/rrhh/activos': 'hr.activos',
  '/panel/rrhh/capacitacion': 'hr.capacitacion',
  '/panel/rrhh/roles': 'hr.roles',
  '/panel/config/habitaciones': 'settings.rooms',
  '/panel/auto-messages': 'settings.auto-messages',
  '/panel/message-logs': 'settings.message-logs',
  '/panel/email-queue': 'settings.email-queue',
  '/panel/whatsapp-templates': 'settings.whatsapp',
  '/panel/config/cerraduras': 'settings.locks',
  '/panel/config/pasarelas': 'settings.gateways',
  '/panel/config/dispositivos': 'settings.devices',
  '/panel/push-tokens': 'settings.push',
}

/**
 * Clave de módulo/submódulo para una ruta, por prefijo más largo (así los detalles como
 * /panel/reservas/:id o /panel/rrhh/empleados/:id/expediente heredan la clave del padre).
 * Devuelve undefined si la ruta es CORE (no gateada).
 */
export function moduleKeyForPath(path: string): string | undefined {
  let best: string | undefined
  let bestLen = -1
  for (const route in ROUTE_TO_KEY) {
    if ((path === route || path.startsWith(route + '/')) && route.length > bestLen) {
      best = ROUTE_TO_KEY[route]
      bestLen = route.length
    }
  }
  return best
}

/** ¿La ruta está habilitada según el estado efectivo del hotel? CORE (sin clave) siempre true. */
export function isRouteEnabled(path: string, state: Record<string, boolean>): boolean {
  const key = moduleKeyForPath(path)
  return !key || state[key] !== false
}

// Módulo de permiso (shared/permissions.ts MODULES) → clave del catálogo de producto que lo habilita.
// El dueño del hotel solo reparte permisos de los módulos que la plataforma le liberó (plan ∩ global):
// esta tabla dice qué módulo de producto respalda cada grupo de permisos. Lo NO mapeado es transversal
// y siempre se muestra (dashboard, settings/Configuración Base, feedback).
export const PERMISSION_TO_MODULE: Record<string, string> = {
  reservations: 'reservations',
  guests: 'guests',
  rooms: 'settings.rooms',
  housekeeping: 'operations.housekeeping',
  maintenance: 'operations.maintenance',
  billing: 'finance',
  reports: 'finance.reports',
  users: 'hr',
  attendance: 'hr.attendance',
  payroll: 'hr.payroll',
  'channel-manager': 'channel',
  ttlock: 'settings.locks',
  ai: 'ai',
}

/**
 * ¿El dueño puede repartir permisos de este módulo de permiso? Solo si el módulo de producto que lo
 * respalda está habilitado para el hotel. Sin mapeo = transversal/base → siempre true. Fail-open: si el
 * estado no cargó (objeto vacío), no se oculta nada (no dejamos al dueño sin gestionar sus permisos).
 */
export function permissionModuleEnabled(permKey: string, state: Record<string, boolean>): boolean {
  const productKey = PERMISSION_TO_MODULE[permKey]
  return !productKey || state[productKey] !== false
}
