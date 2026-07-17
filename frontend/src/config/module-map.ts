// Fuente ÚNICA ruta del panel → clave de módulo/submódulo del catálogo (backend admin/usecases/modules.ts).
// La usan el menú del hotel (AdminLayout) y el guard de rutas (router) para decidir qué se ve y a qué se
// puede entrar. Lo NO mapeado es CORE: siempre accesible (Dashboard, Configuración Base, Soporte,
// Notificaciones, Booking Engine). Así el hotel nunca queda sin acceso mínimo.

export const ROUTE_TO_KEY: Record<string, string> = {
  '/panel/planning': 'planning',
  '/panel/channel-manager': 'channel',
  '/panel/channel': 'channel',                       // detalle /panel/channel/:id
  '/panel/reservations': 'reservations.list',
  '/panel/checkin': 'reservations.checkin',
  '/panel/guests': 'guests',
  '/panel/housekeeping': 'operations.housekeeping',
  '/panel/maintenance': 'operations.maintenance',
  '/panel/technical-providers': 'operations.providers',
  '/panel/team-chat': 'operations.team-chat',
  '/panel/billing': 'finance.billing',
  '/panel/folios': 'finance.folios',
  '/panel/payments': 'finance.payments',
  '/panel/caja': 'finance.caja',
  '/panel/gastos': 'finance.gastos',
  '/panel/reports': 'finance.reports',
  '/panel/night-audit': 'finance.night-audit',
  '/panel/groups': 'sales.groups',
  '/panel/packages': 'sales.packages',
  '/panel/opiniones': 'sales.reviews',
  '/panel/ai-receptionist': 'ai.receptionist',       // incluye /panel/ai-receptionist/config (prefijo)
  '/panel/ai-gerente': 'ai.manager',
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
  '/panel/rooms': 'settings.rooms',
  '/panel/auto-messages': 'settings.auto-messages',
  '/panel/message-logs': 'settings.message-logs',
  '/panel/email-queue': 'settings.email-queue',
  '/panel/whatsapp-templates': 'settings.whatsapp',
  '/panel/cerraduras': 'settings.locks',
  '/panel/pagos': 'settings.gateways',
  '/panel/devices': 'settings.devices',
  '/panel/push-tokens': 'settings.push',
}

/**
 * Clave de módulo/submódulo para una ruta, por prefijo más largo (así los detalles como
 * /panel/reservations/:id o /panel/rrhh/empleados/:id/expediente heredan la clave del padre).
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
