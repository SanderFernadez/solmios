// composables/usePageTitle.ts — #654: los 71 módulos del panel Hotel Admin/Recepcionista
// usaban el mismo <h1> (nombre del hotel) en TODAS las páginas — con lector de pantalla todas
// se anunciaban igual, y las pestañas del navegador eran indistinguibles. El panel Super Admin
// ya resolvía esto bien (SuperAdminLayout.vue tiene su propio `pageTitle` por route.name); acá
// se reutiliza el MISMO diccionario es que ya alimenta el breadcrumb (Breadcrumbs.vue) — evita
// mantener dos mapeos que divergen.
import { computed, watch, type ComputedRef } from 'vue'
import { useRoute } from 'vue-router'

// Mismo diccionario que Breadcrumbs.vue (fuente única — Breadcrumbs.vue lo importa de acá).
export const ROUTE_LABELS: Record<string, string> = {
  panel: 'Inicio',
  admin: 'Admin',
  dashboard: 'Dashboard',
  'dashboard-general': 'Dashboard',
  planning: 'Planning',
  reservations: 'Reservas',
  reservas: 'Reservas',
  checkin: 'Check-in',
  rooms: 'Habitaciones',
  guests: 'Huéspedes',
  housekeeping: 'Limpieza',
  maintenance: 'Mantenimiento',
  'technical-providers': 'Proveedores de servicios',
  'team-chat': 'Chats del equipo',
  'channel-manager': 'Channel',
  'booking-engine': 'Booking Engine',
  billing: 'Facturación',
  folios: 'Folios',
  payments: 'Links de Pago',
  caja: 'Caja',
  gastos: 'Gastos',
  reports: 'Reportes',
  'night-audit': 'Night Audit',
  groups: 'Grupos',
  packages: 'Promociones',
  opiniones: 'Reseñas',
  resenas: 'Reseñas',
  crm: 'CRM',
  ai: 'IA',
  'ai-receptionist': 'Recepcionista IA',
  'ai-gerente': 'Gerente IA',
  config: 'Configuración',
  rrhh: 'RRHH',
  empleados: 'Empleados',
  evaluacion: 'Evaluación de Desempeño',
  attendance: 'Asistencia',
  payroll: 'Nómina',
  reclutamiento: 'Reclutamiento',
  reembolsos: 'Reembolsos',
  organigrama: 'Organigrama',
  team: 'Equipo',
  activos: 'Activos',
  capacitacion: 'Capacitación',
  roles: 'Roles y Permisos',
  settings: 'Configuración',
  mensajeria: 'Mensajería',
  'auto-messages': 'Envíos Auto',
  'message-logs': 'Historial Envíos',
  'email-queue': 'Cola de Emails',
  'whatsapp-templates': 'Plantillas WhatsApp',
  cerraduras: 'Cerraduras',
  pagos: 'Pasarelas de Pago',
  devices: 'Dispositivos',
  'push-tokens': 'Notificaciones Push',
  notifications: 'Notificaciones',
  support: 'Soporte',
  finanzas: 'Finanzas',
  operaciones: 'Operaciones',
  ventas: 'Ventas',
  ia: 'IA',
  limpieza: 'Limpieza',
  mantenimiento: 'Mantenimiento',
  proveedores: 'Proveedores de servicios',
  chats: 'Chats del equipo',
  facturacion: 'Facturación',
  'links-pago': 'Links de Pago',
  reportes: 'Reportes',
  grupos: 'Grupos',
  promociones: 'Promociones',
  recepcionista: 'Recepcionista IA',
  gerente: 'Gerente IA',
  habitaciones: 'Habitaciones',
  pasarelas: 'Pasarelas de Pago',
  dispositivos: 'Dispositivos',
  hotels: 'Hoteles',
  subscriptions: 'Suscripciones',
  analytics: 'Analíticas',
  users: 'Usuarios',
  audit: 'Auditoría',
  feedback: 'Feedback',
  monitoring: 'Monitoreo',
  announcements: 'Anuncios',
  plans: 'Planes',
  amenities: 'Amenities',
  'api-keys': 'API Keys',
}

/** Último segmento navegable del path (ignora :params) traducido con ROUTE_LABELS. */
export function moduleLabelForPath(path: string, params: Record<string, unknown> = {}): string {
  const paramValues = new Set(Object.values(params).flat().filter(Boolean) as string[])
  const segments = path.split('/').filter(Boolean)
  for (let i = segments.length - 1; i >= 0; i--) {
    const seg = segments[i]
    if (paramValues.has(seg)) continue
    if (ROUTE_LABELS[seg]) return ROUTE_LABELS[seg]
  }
  return 'Dashboard'
}

/** h1 real por módulo + document.title reactivo. Un solo `watch` global evita registrar N. */
export function usePageTitle(): ComputedRef<string> {
  const route = useRoute()
  const label = computed(() => moduleLabelForPath(route.path, route.params))
  watch(label, (l) => { document.title = `${l} — SolmiOS` }, { immediate: true })
  return label
}
