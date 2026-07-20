<script setup lang="ts">
// Breadcrumbs.vue — Migas de pan DERIVADAS de la ruta actual (sin meta por-ruta).
// Parsea route.path en segmentos y los traduce con un diccionario es.
// Reglas:
//  - Se oculta si la profundidad es <= 1 (una sola sección).
//  - Cada miga menos la última es <router-link> (si resuelve a una ruta real).
//  - Un segmento que es un :param (id) → se muestra como 'Detalle' (no rompe).
//  - Segmento desconocido → se capitaliza.
import { computed } from 'vue'
import { useRoute, useRouter } from 'vue-router'

const route = useRoute()
const router = useRouter()

// Diccionario es: cubre las secciones reales del panel + admin (ver AdminLayout + router).
const LABELS: Record<string, string> = {
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
  // Las 5 de abajo ya no son rutas propias (redirigen a /panel/config/mensajeria?tab=),
  // pero se dejan mapeadas por si el breadcrumb las ve en tránsito.
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
  // Prefijos de sección y hojas renombradas al agrupar las rutas por su clave de módulo
  // (finance.* → /finanzas, operations.* → /operaciones, ...). Sin estas claves el breadcrumb
  // cae en capitalize() y muestra "Ia", "Links-pago", "Facturacion".
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

// Home por raíz: la primera miga apunta a un destino navegable real.
const HOME_PATH: Record<string, string> = {
  panel: '/panel/dashboard',
  admin: '/admin',
}

// Valores de los :params de la ruta → detectar segmentos que son ids.
const paramValues = computed(() => new Set(Object.values(route.params).flat().filter(Boolean) as string[]))

function capitalize(s: string): string {
  const clean = s.replace(/-/g, ' ')
  return clean.charAt(0).toUpperCase() + clean.slice(1)
}

function labelFor(segment: string, index: number): string {
  if (index === 0 && LABELS[segment]) return LABELS[segment]
  if (paramValues.value.has(segment)) return 'Detalle'
  return LABELS[segment] ?? capitalize(segment)
}

interface Crumb {
  label: string
  to: string
  clickable: boolean
}

const crumbs = computed<Crumb[]>(() => {
  const segments = route.path.split('/').filter(Boolean)
  let acc = ''
  return segments.map((seg, i) => {
    acc += '/' + seg
    const isLast = i === segments.length - 1
    const to = i === 0 ? (HOME_PATH[seg] ?? acc) : acc
    // Clickable solo si no es la última Y resuelve a una ruta real (no al catch-all).
    let clickable = false
    if (!isLast) {
      try {
        const resolved = router.resolve(to)
        clickable = resolved.name !== 'not-found' && resolved.matched.length > 0
      } catch {
        clickable = false
      }
    }
    return { label: labelFor(seg, i), to, clickable }
  })
})

// Ocultar si hay una sola sección (profundidad <= 1).
const visible = computed(() => crumbs.value.length > 1)
</script>

<template>
  <nav v-if="visible" aria-label="Migas de pan" class="mb-4 flex items-center gap-1.5 text-[13px] font-semibold">
    <template v-for="(crumb, i) in crumbs" :key="crumb.to + i">
      <router-link
        v-if="crumb.clickable"
        :to="crumb.to"
        class="text-text-muted transition-colors hover:text-navy"
      >{{ crumb.label }}</router-link>
      <span
        v-else
        :class="i === crumbs.length - 1 ? 'text-navy font-black' : 'text-text-muted'"
        :aria-current="i === crumbs.length - 1 ? 'page' : undefined"
      >{{ crumb.label }}</span>
      <span v-if="i < crumbs.length - 1" class="text-text-muted/60 select-none" aria-hidden="true">/</span>
    </template>
  </nav>
</template>

<style scoped></style>
