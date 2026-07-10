<template>
  <div class="flex min-h-screen bg-surface">
    <!-- Offline banner (PWA) -->
    <OfflineBanner />

    <!-- Impersonation Banner -->
    <div v-if="auth.impersonating" class="fixed top-0 left-0 right-0 z-50 bg-orange border-b-2 border-orange-dark px-4 py-2.5 flex items-center justify-between">
      <div class="flex items-center gap-3">
        <span class="text-sm font-extrabold text-navy">👁️ Modo supervisión: <span class="underline">{{ auth.user?.name }}</span> — {{ auth.user?.hotelName }}</span>
        <span class="text-[10px] font-bold bg-navy/10 text-navy px-2 py-0.5 rounded-full uppercase">{{ auth.user?.role }}</span>
      </div>
      <button @click="auth.stopImpersonation(); router.push('/admin')" class="text-sm font-extrabold text-navy bg-white px-4 py-1.5 rounded-lg hover:bg-surface transition-colors cursor-pointer">✕ Volver a Super Admin</button>
    </div>

    <!-- Mobile backdrop -->
    <div v-if="mobileMenuOpen" class="fixed inset-0 bg-navy/50 z-20 lg:hidden" @click="mobileMenuOpen = false"></div>

    <!-- Sidebar -->
    <aside class="w-72 bg-[#11233E] text-[#C4C8D0] flex flex-col shrink-0 fixed h-full z-30 transition-transform duration-300 lg:translate-x-0"
      :class="[auth.impersonating ? 'top-10' : '', mobileMenuOpen ? 'translate-x-0' : '-translate-x-full']">
      <!-- Logo -->
      <div class="h-20 flex items-center gap-3 px-5 border-b border-white/10">
        <div class="w-12 h-12 rounded-lg bg-gradient-to-br from-cyan to-blue flex items-center justify-center font-black text-2xl shadow-lg shrink-0">S</div>
        <div>
          <div class="font-black text-2xl leading-tight">Solmi<span class="text-cyan">OS</span></div>
          <div class="text-[10px] font-bold tracking-[2px] text-[#C4C8D0] uppercase">{{ roleLabel }}</div>
        </div>
      </div>

      <!-- Navigation -->
      <nav class="flex-1 py-4 px-3 space-y-0.5 overflow-y-auto scrollbar-hide">
        <template v-for="item in visibleItems" :key="item.path || item.label">
          <!-- Parent with children -->
          <template v-if="item.children">
            <button @click="toggleSection(item.label)" class="w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-base font-semibold cursor-pointer transition-all"
              :class="isSectionActive(item) ? 'bg-white/15 text-white' : 'text-[#C4C8D0] hover:bg-white/5 hover:text-white'">
              <span class="w-5 h-5 shrink-0 text-[#C4C8D0]" v-html="item.icon"></span>
              <span class="flex-1 text-left">{{ item.label }}</span>
              <span class="text-[10px]">{{ item.expanded ? '▾' : '▸' }}</span>
            </button>
            <router-link
              v-for="child in item.children"
              :key="child.path"
              :to="child.path"
              v-show="item.expanded"
              class="flex items-center gap-2.5 pl-11 pr-3 py-2 rounded-lg text-base font-semibold transition-all cursor-pointer"
              :class="isActive(child.path) ? 'bg-white/8 text-white' : 'text-[#C4C8D0] hover:bg-white/5 hover:text-white'"
            >
              <span class="w-1.5 h-1.5 rounded-full shrink-0" :class="isActive(child.path) ? 'bg-cyan' : 'bg-[#C4C8D0]'"></span>
              <span>{{ child.label }}</span>
            </router-link>
          </template>
          <!-- Simple item (no children) -->
          <router-link v-else :to="item.path"
            class="flex items-center gap-3 px-3 py-2.5 rounded-lg text-base font-semibold transition-all cursor-pointer"
            :class="isActive(item.path) ? 'bg-white/15 text-white' : 'text-[#C4C8D0] hover:bg-white/5 hover:text-white'">
            <span class="w-5 h-5 shrink-0 text-[#C4C8D0]" v-html="item.icon"></span>
            <span>{{ item.label }}</span>
          </router-link>
        </template>

        <!-- Ocupación Hoy (dentro del nav: scrollea junto al menú cuando los submenus expandidos exceden el alto disponible) -->
        <div class="mt-3 p-4 rounded-xl bg-white/5 border border-white/10">
          <div class="text-xs font-bold tracking-wider text-[#C4C8D0] uppercase mb-3">Ocupación Hoy</div>
          <div class="flex items-center gap-4">
            <div class="relative w-20 h-20 shrink-0">
              <svg viewBox="0 0 36 36" class="w-20 h-20 -rotate-90">
                <circle cx="18" cy="18" r="15.5" fill="none" stroke="rgba(255,255,255,0.1)" stroke-width="3.5" />
                <circle cx="18" cy="18" r="15.5" fill="none" stroke="#22D3EE" stroke-width="3.5" stroke-linecap="round"
                  :stroke-dasharray="`${occupancyPct * 0.974} 100`" />
              </svg>
              <div class="absolute inset-0 flex items-center justify-center text-lg font-black">{{ occupancyPct }}%</div>
            </div>
            <div class="flex-1 space-y-2">
              <div class="flex items-center justify-between text-xs">
                <span class="flex items-center gap-1.5 text-[#C4C8D0]"><span class="w-2 h-2 rounded-full bg-cyan"></span>Ocupadas</span>
                <span class="font-bold">{{ occupancyBreakdown.occupied }}</span>
              </div>
              <div class="flex items-center justify-between text-xs">
                <span class="flex items-center gap-1.5 text-[#C4C8D0]"><span class="w-2 h-2 rounded-full bg-blue"></span>Disponibles</span>
                <span class="font-bold">{{ occupancyBreakdown.available }}</span>
              </div>
              <div class="flex items-center justify-between text-xs">
                <span class="flex items-center gap-1.5 text-[#C4C8D0]"><span class="w-2 h-2 rounded-full bg-gray-400"></span>Mantenimiento</span>
                <span class="font-bold">{{ occupancyBreakdown.maintenance }}</span>
              </div>
            </div>
          </div>
        </div>
      </nav>

      <!-- PC-2 Multi-property: Hotel Switcher -->
      <div class="border-t border-white/10 py-2 px-3">
        <HotelSwitcher />
      </div>

      <!-- User -->
      <div class="p-4 border-t border-white/10">
        <div class="flex items-center gap-3">
          <div class="w-9 h-9 rounded-full flex items-center justify-center text-sm font-bold" :class="avatarClass">
            {{ userInitials }}
          </div>
          <div class="flex-1 min-w-0">
            <div class="text-sm font-bold truncate">{{ auth.user?.name ?? 'Admin' }}</div>
            <div class="text-[10px] text-[#C4C8D0]">{{ auth.currentHotel }}</div>
          </div>
          <button @click="handleLogout" class="text-[#C4C8D0] hover:text-white transition-colors cursor-pointer">
            <svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1" />
            </svg>
          </button>
        </div>
      </div>
    </aside>

    <!-- Main Content -->
    <div class="flex-1 min-w-0 lg:ml-72 flex flex-col" :class="auth.impersonating ? 'mt-10' : ''">
      <!-- Header -->
      <header class="h-16 bg-white border-b border-border flex items-center justify-between px-4 md:px-6 sticky top-0 z-10 gap-3">
        <div class="flex items-center gap-3 min-w-0">
          <button @click="mobileMenuOpen = true" class="lg:hidden shrink-0 w-9 h-9 flex items-center justify-center rounded-lg text-text-secondary hover:bg-surface cursor-pointer">
            <span class="w-5 h-5 shrink-0 block" v-html="ICON_MENU"></span>
          </button>
          <div class="min-w-0">
            <h1 class="text-lg font-black text-navy truncate leading-tight">{{ pageTitle }}</h1>
            <p class="text-[11px] text-text-muted truncate hidden sm:block">{{ auth.currentHotel }}</p>
          </div>
        </div>
        <div class="flex items-center gap-2">
          <!-- Search -->
          <div class="relative hidden md:block">
            <input type="text" placeholder="Buscar..." class="w-56 h-9 pl-9 pr-4 rounded-xl border border-transparent text-sm bg-surface focus:outline-none focus:bg-white focus:border-cyan focus:ring-2 focus:ring-cyan/20 transition-all" />
            <svg class="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-text-muted" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
            </svg>
          </div>

          <!-- Notifications bell (componente dedicado) -->
          <NotificationBell />

          <div class="w-px h-6 bg-border"></div>

          <!-- User Menu (Configuración / Cambiar contraseña / Salir) -->
          <UserMenu />
        </div>
      </header>

      <!-- Anuncios internos del sistema (FC-B1) -->
      <AnnouncementBanner />

      <!-- Page Content -->
      <main class="flex-1 p-6" data-feedback-content>
        <router-view />
      </main>
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed, ref, watch, onMounted, onUnmounted } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { useAuthStore } from '@/stores/auth.store'
import { useDashboardStore } from '@/stores/dashboard.store'
import { useRoomStore } from '@/stores/room.store'
import NotificationBell from '@/components/features/core-pms/NotificationBell.vue'
import AnnouncementBanner from '@/components/features/core-pms/AnnouncementBanner.vue'
import OfflineBanner from '@/components/features/core-pms/OfflineBanner.vue'
import HotelSwitcher from '@/components/features/core-pms/HotelSwitcher.vue'
import UserMenu from '@/components/features/core-pms/UserMenu.vue'

const ICON_MENU = '<svg viewBox="0 0 24 24" class="w-full h-full" fill="none" stroke="currentColor" stroke-width="2"><path stroke-linecap="round" stroke-linejoin="round" d="M3.75 6.75h16.5M3.75 12h16.5M3.75 17.25h16.5"/></svg>'

const route = useRoute()
const router = useRouter()
const auth = useAuthStore()
const dashboard = useDashboardStore()
const roomStore = useRoomStore()
const mobileMenuOpen = ref(false)

// Cierra el drawer mobile al navegar a otra ruta
watch(() => route.path, () => { mobileMenuOpen.value = false })

const ICONS = {
  dashboard: '<svg fill="none" stroke="currentColor" viewBox="0 0 24 24" stroke-width="2"><path stroke-linecap="round" stroke-linejoin="round" d="M3 13.5h4.5V21H3v-7.5ZM9.75 8.25h4.5V21h-4.5V8.25ZM16.5 3h4.5v18h-4.5V3Z"/></svg>',
  calendar: '<svg fill="none" stroke="currentColor" viewBox="0 0 24 24" stroke-width="2"><path stroke-linecap="round" stroke-linejoin="round" d="M7 3v3M17 3v3M4 9h16M5 6h14a1 1 0 0 1 1 1v12a1 1 0 0 1-1 1H5a1 1 0 0 1-1-1V7a1 1 0 0 1 1-1Z"/></svg>',
  bed: '<svg fill="none" stroke="currentColor" viewBox="0 0 24 24" stroke-width="2"><path stroke-linecap="round" stroke-linejoin="round" d="M3 18v-7a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2v7M3 18v2M3 18h18M21 18v2M5 13V9a2 2 0 0 1 2-2h2a2 2 0 0 1 2 2v4"/></svg>',
  user: '<svg fill="none" stroke="currentColor" viewBox="0 0 24 24" stroke-width="2"><path stroke-linecap="round" stroke-linejoin="round" d="M16 21v-1a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v1M12 11a4 4 0 1 0 0-8 4 4 0 0 0 0 8Z"/></svg>',
  wallet: '<svg fill="none" stroke="currentColor" viewBox="0 0 24 24" stroke-width="2"><path stroke-linecap="round" stroke-linejoin="round" d="M3 7a2 2 0 0 1 2-2h12a2 2 0 0 1 2 2v10a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V7Z"/><path stroke-linecap="round" stroke-linejoin="round" d="M16 12h.01M3 10h18"/></svg>',
  link: '<svg fill="none" stroke="currentColor" viewBox="0 0 24 24" stroke-width="2"><path stroke-linecap="round" stroke-linejoin="round" d="M13.5 10.5 21 3M16.5 3H21v4.5M10.5 13.5 3 21M7.5 21H3v-4.5"/></svg>',
  sparkles: '<svg fill="none" stroke="currentColor" viewBox="0 0 24 24" stroke-width="2"><path stroke-linecap="round" stroke-linejoin="round" d="M9.813 15.904 9 18.75l-.813-2.846a4.5 4.5 0 0 0-3.09-3.09L2.25 12l2.846-.813a4.5 4.5 0 0 0 3.09-3.09L9 5.25l.813 2.846a4.5 4.5 0 0 0 3.09 3.09L15.75 12l-2.846.813a4.5 4.5 0 0 0-3.09 3.09ZM18.259 8.715 18 9.75l-.259-1.035a3.375 3.375 0 0 0-2.455-2.456L14.25 6l1.035-.259a3.375 3.375 0 0 0 2.456-2.455L18 2.25l.259 1.035a3.375 3.375 0 0 0 2.456 2.456L21.75 6l-1.035.259a3.375 3.375 0 0 0-2.456 2.456Z"/></svg>',
  heart: '<svg fill="none" stroke="currentColor" viewBox="0 0 24 24" stroke-width="2"><path stroke-linecap="round" stroke-linejoin="round" d="M21 8.25c0-2.485-2.099-4.5-4.688-4.5-1.935 0-3.597 1.126-4.312 2.733-.715-1.607-2.377-2.733-4.313-2.733C5.1 3.75 3 5.765 3 8.25c0 7.22 9 12 9 12s9-4.78 9-12Z"/></svg>',
  usergroup: '<svg fill="none" stroke="currentColor" viewBox="0 0 24 24" stroke-width="2"><path stroke-linecap="round" stroke-linejoin="round" d="M18 18.72a9.094 9.094 0 0 0 3.741-.479 3 3 0 0 0-4.682-2.72M18 18.72a9.094 9.094 0 0 1-3.741-.479 3 3 0 0 1 4.682-2.72M18 18.72v-.235a3 3 0 0 0-3-3M6 18.72a9.094 9.094 0 0 1-3.741-.479 3 3 0 0 1 4.682-2.72M6 18.72v-.235a3 3 0 0 1 3-3m3.75-6.75a3 3 0 1 1-6 0 3 3 0 0 1 6 0Zm6 3a2.25 2.25 0 1 1-4.5 0 2.25 2.25 0 0 1 4.5 0Zm-13.5 0a2.25 2.25 0 1 1-4.5 0 2.25 2.25 0 0 1 4.5 0Z"/></svg>',
  cog: '<svg fill="none" stroke="currentColor" viewBox="0 0 24 24" stroke-width="2"><path stroke-linecap="round" stroke-linejoin="round" d="M9.594 3.94c.09-.542.56-.94 1.11-.94h2.593c.55 0 1.02.398 1.11.94l.213 1.281c.063.374.313.686.645.87.074.04.147.083.22.127.324.196.72.257 1.075.124l1.217-.456a1.125 1.125 0 0 1 1.37.49l1.296 2.247a1.125 1.125 0 0 1-.26 1.431l-1.003.827c-.293.241-.438.613-.43.992a7.723 7.723 0 0 1 0 .255c-.008.378.137.75.43.991l1.004.827c.424.35.534.955.26 1.43l-1.298 2.247a1.125 1.125 0 0 1-1.369.491l-1.217-.456c-.355-.133-.75-.072-1.076.124a6.47 6.47 0 0 1-.22.128c-.331.183-.581.495-.644.869l-.213 1.281c-.09.543-.56.94-1.11.94h-2.594c-.55 0-1.02-.397-1.11-.94l-.213-1.281c-.062-.374-.312-.686-.644-.87a6.52 6.52 0 0 1-.22-.127c-.325-.196-.72-.257-1.076-.124l-1.217.456a1.125 1.125 0 0 1-1.369-.49l-1.297-2.247a1.125 1.125 0 0 1 .26-1.431l1.004-.827c.292-.241.437-.613.43-.991a7.66 7.66 0 0 1 0-.255c.007-.38-.138-.751-.43-.992l-1.004-.827a1.125 1.125 0 0 1-.26-1.43l1.297-2.247a1.125 1.125 0 0 1 1.37-.491l1.216.456c.356.133.751.072 1.076-.124.072-.044.146-.087.22-.128.332-.183.582-.495.644-.869l.214-1.28Z"/><path stroke-linecap="round" stroke-linejoin="round" d="M15 12a3 3 0 1 1-6 0 3 3 0 0 1 6 0Z"/></svg>',
  support: '<svg fill="none" stroke="currentColor" viewBox="0 0 24 24" stroke-width="2"><path stroke-linecap="round" stroke-linejoin="round" d="M9.879 7.519c1.171-1.025 3.071-1.025 4.242 0 1.172 1.025 1.172 2.687 0 3.712-.203.179-.43.326-.67.442-.745.361-1.45.999-1.45 1.827v.75M21 12a9 9 0 1 1-18 0 9 9 0 0 1 18 0Zm-9 5.25h.008v.008H12v-.008Z"/></svg>',
}

const nonavItems = [
  {
    label: 'Dashboard', icon: ICONS.dashboard, path: '/panel/dashboard/administrativo', roles: ['hotel_admin', 'receptionist'],
  },
  {
    label: 'Planning', icon: ICONS.calendar, path: '/panel/planning', roles: ['hotel_admin', 'receptionist'],
  },
  {
    label: 'Channel Manager', icon: ICONS.link, path: '/panel/channel-manager', roles: ['hotel_admin'],
  },
  {
    label: 'Reservas', icon: ICONS.calendar, roles: ['hotel_admin', 'receptionist'],
    children: [
      { label: 'Reservas', path: '/panel/reservations', roles: ['hotel_admin', 'receptionist'] },
      { label: 'Check-in/out', path: '/panel/checkin', roles: ['hotel_admin', 'receptionist'] },
    ]
  },
  {
    label: 'Habitaciones', icon: ICONS.bed, roles: ['hotel_admin', 'receptionist'],
    children: [
      { label: 'Habitaciones', path: '/panel/rooms', roles: ['hotel_admin', 'receptionist'] },
      { label: 'Limpieza', path: '/panel/housekeeping', roles: ['hotel_admin'] },
      { label: 'Mantenimiento', path: '/panel/maintenance', roles: ['hotel_admin'] },
    ]
  },
  {
    label: 'Huéspedes', icon: ICONS.user, path: '/panel/guests', roles: ['hotel_admin', 'receptionist'] },
  {
    label: 'Finanzas', icon: ICONS.wallet, roles: ['hotel_admin'],
    children: [
      { label: 'Facturación', path: '/panel/billing', roles: ['hotel_admin'] },
      { label: 'Folios In-House', path: '/panel/folios', roles: ['hotel_admin', 'receptionist'] },
      { label: 'Links de Pago', path: '/panel/payments', roles: ['hotel_admin', 'receptionist'] },
      { label: 'Caja', path: '/panel/caja', roles: ['hotel_admin'] },
      { label: 'Gastos', path: '/panel/gastos', roles: ['hotel_admin'] },
      { label: 'Reportes', path: '/panel/reports', roles: ['hotel_admin'] },
      { label: 'Night Audit', path: '/panel/night-audit', roles: ['hotel_admin'] },
    ]
  },
  {
    label: 'Ventas', icon: ICONS.link, roles: ['hotel_admin'],
    children: [
      { label: 'Grupos', path: '/panel/groups', roles: ['hotel_admin'] },
      { label: 'Ofertas', path: '/panel/packages', roles: ['hotel_admin'] },
      { label: 'Reseñas', path: '/panel/opiniones', roles: ['hotel_admin', 'receptionist'] },
    ]
  },
  {
    label: 'IA', icon: ICONS.sparkles, roles: ['hotel_admin', 'receptionist'],
    children: [
      { label: 'Recepcionista', path: '/panel/ai-receptionist', roles: ['hotel_admin', 'receptionist'] },
      { label: 'Configuración IA', path: '/panel/ai-receptionist/config', roles: ['hotel_admin'] },
    ]
  },
  {
    label: 'CRM', icon: ICONS.heart, roles: ['hotel_admin'],
    children: [
      { label: 'Fidelización', path: '/panel/crm', roles: ['hotel_admin'] },
    ]
  },
  {
    label: 'RRHH', icon: ICONS.usergroup, roles: ['hotel_admin', 'receptionist'],
    children: [
      { label: 'Empleados', path: '/panel/empleados', roles: ['hotel_admin', 'receptionist'] },
      { label: 'Asistencia', path: '/panel/attendance', roles: ['hotel_admin', 'receptionist'] },
      { label: 'Nómina', path: '/panel/payroll', roles: ['hotel_admin'] },
      { label: 'Equipo', path: '/panel/team', roles: ['hotel_admin'] },
    ]
  },
  {
    label: 'Configuración', icon: ICONS.cog, roles: ['hotel_admin'],
    children: [
      { label: 'Configuración', path: '/panel/settings', roles: ['hotel_admin'] },
      { label: 'Envíos Auto', path: '/panel/auto-messages', roles: ['hotel_admin'] },
      { label: 'Historial Envíos', path: '/panel/message-logs', roles: ['hotel_admin', 'receptionist'] },
      { label: 'Plantillas WhatsApp', path: '/panel/whatsapp-templates', roles: ['hotel_admin', 'receptionist'] },
      { label: 'Cerraduras', path: '/panel/cerraduras', roles: ['hotel_admin'] },
      { label: 'Dispositivos', path: '/panel/devices', roles: ['hotel_admin'] },
    ]
  },
  {
    label: 'Soporte', icon: ICONS.support, path: '/panel/support', roles: ['hotel_admin', 'receptionist'],
  },
]

const sectionLabels = nonavItems.filter(i => i.children).map(i => i.label)

function sectionContainsRoute(item: any) {
  return item.children?.some((c: any) => route.path.startsWith(c.path)) ?? false
}

// Todas las secciones inician colapsadas, salvo la que contiene la ruta activa
const collapsedSections = ref(new Set(
  sectionLabels.filter(label => !sectionContainsRoute(nonavItems.find(i => i.label === label)))
))

// Acordeón: abrir una sección cierra las demás, así nunca hay más de un menú principal sombreado
function toggleSection(section: string) {
  const wasOpen = !collapsedSections.value.has(section)
  const s = new Set(sectionLabels)
  if (!wasOpen) s.delete(section)
  collapsedSections.value = s
}

interface NavItem {
  label: string
  icon?: string
  path: string
  roles: string[]
  children?: NavItem[]
  expanded?: boolean
}

function isSectionActive(item: any) {
  if (item.children) return sectionContainsRoute(item)
  return isActive(item.path)
}

const visibleItems = computed(() => {
  const role = auth.userRole ?? ''
  // El literal nonavItems mezcla padres (con children, sin path) y hojas (con path);
  // unificamos a NavItem. El template usa path/expanded solo en la rama que corresponde.
  const items = nonavItems as unknown as NavItem[]
  return items
    .filter((item) => {
      if (item.children) return item.children.some((c) => c.roles.includes(role))
      return item.roles.includes(role)
    })
    .map((item) => {
      if (item.children) {
        const children = item.children.filter((c) => c.roles.includes(role))
        return { ...item, children, expanded: !collapsedSections.value.has(item.label) }
      }
      return item
    })
})

const occupancyPct = computed(() => dashboard.stats.occupancy)

const occupancyBreakdown = computed(() => {
  const byStatus = dashboard.stats.roomsByStatus
  return {
    occupied: byStatus.occupied ?? 0,
    available: byStatus.available ?? 0,
    maintenance: (byStatus.out_of_service ?? 0) + (byStatus.dirty ?? 0) + (byStatus.cleaning ?? 0),
  }
})

onMounted(() => {
  dashboard.fetchStats(auth.user?.hotelId)
})

const roleLabel = computed(() => {
  const labels: Record<string, string> = {
    hotel_admin: 'Panel Hotel',
    receptionist: 'Recepción',
    super_admin: 'Super Admin'
  }
  return labels[auth.userRole ?? ''] ?? 'Panel Hotel'
})

const avatarClass = computed(() => {
  const classes: Record<string, string> = {
    hotel_admin: 'bg-cyan/30 text-white',
    receptionist: 'bg-teal/30 text-white',
    super_admin: 'bg-coral/30 text-white'
  }
  return classes[auth.userRole ?? ''] ?? 'bg-cyan/30 text-white'
})

const userInitials = computed(() => {
  const name = auth.user?.name ?? 'Admin'
  return name.split(' ').map(n => n[0]).join('').slice(0, 2).toUpperCase()
})

const pageTitle = computed(() => {
  const titles: Record<string, string> = {
    'dashboard-general': 'Dashboard General',
    'dashboard-administrativo': 'Dashboard Administrativo',
    planning: 'Planning',
    reservations: 'Reservas',
    rooms: 'Habitaciones',
    guests: 'Huéspedes',
    checkin: 'Check-in Digital',
    housekeeping: 'Housekeeping',
    maintenance: 'Mantenimiento',
    'channel-manager': 'Channel Manager',
    'booking-engine': 'Booking Engine',
    packages: 'Ofertas',
    groups: 'Grupos',
    'night-audit': 'Night Audit',
    billing: 'Facturación',
    folios: 'Folios In-House',
    payments: 'Links de Pago',
    gastos: 'Gastos',
    reports: 'Reportes',
    opiniones: 'Opiniones',
    'auto-messages': 'Envíos Automáticos',
    'message-logs': 'Historial de Envíos',
    'whatsapp-templates': 'Plantillas WhatsApp',
    caja: 'Caja',
    cerraduras: 'Cerraduras TTLock',
    devices: 'Dispositivos',
    support: 'Soporte',
    settings: 'Configuración',
    team: 'Equipo',
    empleados: 'Empleados',
    payroll: 'Nómina',
    attendance: 'Asistencia',
    crm: 'CRM y Fidelización',
  }
  return titles[route.name as string] ?? 'Panel'
})

function isActive(path: string) {
  return route.path.startsWith(path)
}

async function handleLogout() {
  await auth.logout()
  router.push('/login')
}
</script>
