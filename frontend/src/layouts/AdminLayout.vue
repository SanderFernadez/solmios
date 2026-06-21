<template>
  <div class="flex min-h-screen bg-surface">
    <!-- Impersonation Banner -->
    <div v-if="auth.impersonating" class="fixed top-0 left-0 right-0 z-50 bg-orange border-b-2 border-orange-dark px-4 py-2.5 flex items-center justify-between">
      <div class="flex items-center gap-3">
        <span class="text-sm font-extrabold text-navy">👁️ Modo supervisión: <span class="underline">{{ auth.user?.name }}</span> — {{ auth.user?.hotelName }}</span>
        <span class="text-[10px] font-bold bg-navy/10 text-navy px-2 py-0.5 rounded-full uppercase">{{ auth.user?.role }}</span>
      </div>
      <button @click="auth.stopImpersonation(); router.push('/admin')" class="text-sm font-extrabold text-navy bg-white px-4 py-1.5 rounded-lg hover:bg-surface transition-colors cursor-pointer">✕ Volver a Super Admin</button>
    </div>

    <!-- Sidebar -->
    <aside class="w-64 bg-navy text-white flex flex-col flex-shrink-0 fixed h-full z-20" :class="auth.impersonating ? 'top-10' : ''">
      <!-- Logo -->
      <div class="h-16 flex items-center gap-3 px-5 border-b border-white/10">
        <div class="w-9 h-9 rounded-lg bg-gradient-to-br from-cyan to-blue flex items-center justify-center font-black text-lg shadow-lg">M</div>
        <div>
          <div class="font-black text-lg leading-tight">Manager<span class="text-cyan">Hotel</span></div>
          <div class="text-[9px] font-bold tracking-[2px] text-gray-400 uppercase">{{ roleLabel }}</div>
        </div>
      </div>

      <!-- Navigation -->
      <nav class="flex-1 py-4 px-3 space-y-0.5 overflow-y-auto">
        <template v-for="item in visibleItems" :key="item.path || item.label">
          <!-- Parent with children -->
          <template v-if="item.children">
            <button @click="toggleSection(item.label)" class="w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-semibold cursor-pointer transition-all"
              :class="item.expanded ? 'bg-white/15 text-white' : 'text-gray-400 hover:bg-white/5 hover:text-white'">
              <span class="text-lg">{{ item.icon }}</span>
              <span class="flex-1 text-left">{{ item.label }}</span>
              <span class="text-[10px]">{{ item.expanded ? '▾' : '▸' }}</span>
            </button>
            <router-link
              v-for="child in item.children"
              :key="child.path"
              :to="child.path"
              v-show="item.expanded"
              class="flex items-center gap-3 pl-11 pr-3 py-2.5 rounded-lg text-sm font-semibold transition-all cursor-pointer"
              :class="isActive(child.path) ? 'bg-white/15 text-white' : 'text-gray-400 hover:bg-white/5 hover:text-white'"
            >
              <span>{{ child.label }}</span>
            </router-link>
          </template>
          <!-- Simple item (no children) -->
          <router-link v-else :to="item.path"
            class="flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-semibold transition-all cursor-pointer"
            :class="isActive(item.path) ? 'bg-white/15 text-white' : 'text-gray-400 hover:bg-white/5 hover:text-white'">
            <span class="text-lg">{{ item.icon }}</span>
            <span>{{ item.label }}</span>
          </router-link>
        </template>
      </nav>

      <!-- User -->
      <div class="p-4 border-t border-white/10">
        <div class="flex items-center gap-3">
          <div class="w-9 h-9 rounded-full flex items-center justify-center text-sm font-bold" :class="avatarClass">
            {{ userInitials }}
          </div>
          <div class="flex-1 min-w-0">
            <div class="text-sm font-bold truncate">{{ auth.user?.name ?? 'Admin' }}</div>
            <div class="text-[10px] text-gray-400">{{ auth.currentHotel }}</div>
          </div>
          <button @click="handleLogout" class="text-gray-400 hover:text-white transition-colors cursor-pointer">
            <svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1" />
            </svg>
          </button>
        </div>
      </div>
    </aside>

    <!-- Main Content -->
    <div class="flex-1 ml-64 flex flex-col" :class="auth.impersonating ? 'mt-10' : ''">
      <!-- Header -->
      <header class="h-16 bg-white border-b border-border flex items-center justify-between px-6 sticky top-0 z-10 shadow-sm">
        <div>
          <h1 class="text-lg font-black text-navy">{{ pageTitle }}</h1>
        </div>
        <div class="flex items-center gap-4">
          <!-- Search -->
          <div class="relative">
            <input type="text" placeholder="Buscar..." class="w-64 h-9 pl-9 pr-4 rounded-lg border border-border text-sm bg-surface focus:outline-none focus:border-cyan focus:ring-2 focus:ring-cyan/20 transition-all" />
            <svg class="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-text-muted" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
            </svg>
          </div>

          <!-- Notifications -->
          <div class="relative">
            <button @click="toggleNotifications" class="relative p-2 rounded-lg hover:bg-surface transition-colors cursor-pointer">
              <svg class="w-5 h-5 text-text-secondary" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M15 17h5l-1.405-1.405A2.032 2.032 0 0118 14.158V11a6.002 6.002 0 00-4-5.659V5a2 2 0 10-4 0v.341C7.67 6.165 6 8.388 6 11v3.159c0 .538-.214 1.055-.595 1.436L4 17h5m6 0v1a3 3 0 11-6 0v-1m6 0H9" />
              </svg>
              <span v-if="unreadCount > 0" class="absolute -top-0.5 -right-0.5 min-w-[18px] h-[18px] bg-coral text-white text-[9px] font-bold rounded-full flex items-center justify-center px-1">{{ unreadCount > 99 ? '99+' : unreadCount }}</span>
            </button>
            <!-- Dropdown -->
            <div v-if="showNotifications" class="absolute right-0 top-full mt-2 w-96 bg-white rounded-2xl shadow-2xl border border-border z-50 overflow-hidden">
              <div class="flex items-center justify-between p-4 border-b border-border">
                <h3 class="text-sm font-black text-navy">Notificaciones</h3>
                <button v-if="unreadCount > 0" @click="markAllRead" class="text-[10px] font-bold text-cyan hover:underline cursor-pointer">Marcar todo leído</button>
              </div>
              <div class="max-h-80 overflow-y-auto">
                <div v-if="notifications.length === 0" class="p-8 text-center">
                  <div class="text-3xl mb-2">🔔</div>
                  <div class="text-sm text-text-muted">Sin notificaciones</div>
                </div>
                <div v-else>
                  <div v-for="n in notifications" :key="n.id" @click="markRead(n)" class="flex items-start gap-3 p-4 hover:bg-surface/50 transition-colors cursor-pointer border-b border-border/50 last:border-0" :class="!n.read ? 'bg-cyan/5' : ''">
                    <div class="w-8 h-8 rounded-full flex items-center justify-center text-sm flex-shrink-0" :class="notifIconClass(n.type)">
                      {{ notifIcon(n.type) }}
                    </div>
                    <div class="flex-1 min-w-0">
                      <div class="text-sm font-bold text-navy truncate">{{ n.title }}</div>
                      <div class="text-[11px] text-text-muted line-clamp-2 mt-0.5">{{ n.message }}</div>
                      <div class="text-[9px] text-text-muted mt-1">{{ formatTime(n.createdAt) }}</div>
                    </div>
                    <div v-if="!n.read" class="w-2 h-2 bg-cyan rounded-full flex-shrink-0 mt-2"></div>
                  </div>
                </div>
              </div>
              <div class="p-3 border-t border-border text-center">
                <router-link to="/panel/support" @click="showNotifications = false" class="text-[11px] font-bold text-cyan hover:underline">Ver todas</router-link>
              </div>
            </div>
          </div>

          <!-- Hotel Selector -->
          <div class="flex items-center gap-2 bg-surface rounded-lg px-3 py-1.5 border border-border">
            <span class="text-lg">🏨</span>
            <span class="text-sm font-bold text-navy">{{ auth.currentHotel }}</span>
          </div>
        </div>
      </header>

      <!-- Page Content -->
      <main class="flex-1 p-6">
        <router-view />
      </main>
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed, ref, onMounted, onUnmounted } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { useAuthStore } from '@/stores/auth.store'
import { useDashboardStore } from '@/stores/dashboard.store'
import { useRoomStore } from '@/stores/room.store'
import { OperationsService } from '@/services/Operations.service'

const route = useRoute()
const router = useRouter()
const auth = useAuthStore()
const dashboard = useDashboardStore()
// All nested sections start collapsed
const collapsedSections = ref(new Set(['Planificación', 'Habitaciones', 'Finanzas', 'Ventas', 'Configuración']))

function toggleSection(section: string) {
  const s = new Set(collapsedSections.value)
  s.has(section) ? s.delete(section) : s.add(section)
  collapsedSections.value = s
}
const roomStore = useRoomStore()

const showNotifications = ref(false)
const notifications = ref<any[]>([])
const unreadCount = computed(() => notifications.value.filter(n => !n.read).length)

function toggleNotifications() {
  showNotifications.value = !showNotifications.value
  if (showNotifications.value) loadNotifications()
}

function closeOnOutside(e: MouseEvent) {
  const target = e.target as HTMLElement
  if (!target.closest('.relative')) showNotifications.value = false
}

let notifInterval: ReturnType<typeof setInterval> | null = null

onMounted(() => {
  document.addEventListener('click', closeOnOutside)
  loadNotifications()
  notifInterval = setInterval(loadNotifications, 30000)
})
onUnmounted(() => {
  document.removeEventListener('click', closeOnOutside)
  if (notifInterval) clearInterval(notifInterval)
})

async function loadNotifications() {
  try {
    const { data } = await OperationsService.notificaciones(auth.user?.hotelId)
    notifications.value = (data || []).map((n: any) => ({
      id: n.id,
      type: n.type || n.tipo || 'info',
      title: n.title || n.titulo || '',
      message: n.message || n.mensaje || '',
      read: n.read ?? n.leido ?? false,
      createdAt: n.createdAt || '',
    })).slice(0, 20)
  } catch { /* silent */ }
}

function markRead(n: any) {
  n.read = true
}

function markAllRead() {
  notifications.value.forEach(n => n.read = true)
}

function notifIcon(type: string) {
  const map: Record<string, string> = { reservation: '📋', checkin: '✅', checkout: '🚪', alert: '⚠️', info: 'ℹ️', payment: '💰', maintenance: '🔧', housekeeping: '🧹' }
  return map[type?.toLowerCase()] || '🔔'
}

function notifIconClass(type: string) {
  const map: Record<string, string> = { reservation: 'bg-blue-100 text-blue-600', checkin: 'bg-teal-100 text-teal-600', checkout: 'bg-orange-100 text-orange-600', alert: 'bg-red-100 text-red-600', payment: 'bg-green-100 text-green-600', maintenance: 'bg-amber-100 text-amber-600', housekeeping: 'bg-purple-100 text-purple-600' }
  return map[type?.toLowerCase()] || 'bg-gray-100 text-gray-600'
}

function formatTime(dateStr: string) {
  if (!dateStr) return ''
  const d = new Date(dateStr)
  const now = new Date()
  const diff = now.getTime() - d.getTime()
  if (diff < 60000) return 'Ahora'
  if (diff < 3600000) return `Hace ${Math.floor(diff / 60000)} min`
  if (diff < 86400000) return `Hace ${Math.floor(diff / 3600000)}h`
  return d.toLocaleDateString('es-ES', { day: 'numeric', month: 'short' })
}

const nonavItems = [
  { label: 'Dashboard', icon: '📊', path: '/panel', roles: ['hotel_admin', 'receptionist'] },
  {
    label: 'Planificación', icon: '📅', roles: ['hotel_admin', 'receptionist'],
    children: [
      { label: 'Planning', path: '/panel/planning', roles: ['hotel_admin', 'receptionist'] },
      { label: 'Reservas', path: '/panel/reservations', roles: ['hotel_admin', 'receptionist'] },
      { label: 'Check-in/out', path: '/panel/checkin', roles: ['hotel_admin', 'receptionist'] },
    ]
  },
  {
    label: 'Habitaciones', icon: '🚪', roles: ['hotel_admin', 'receptionist'],
    children: [
      { label: 'Habitaciones', path: '/panel/rooms', roles: ['hotel_admin', 'receptionist'] },
      { label: 'Housekeeping', path: '/panel/housekeeping', roles: ['hotel_admin'] },
      { label: 'Mantenimiento', path: '/panel/maintenance', roles: ['hotel_admin'] },
    ]
  },
  {
    label: 'Huéspedes', icon: '👤', path: '/panel/guests', roles: ['hotel_admin', 'receptionist'] },
  {
    label: 'Finanzas', icon: '💰', roles: ['hotel_admin'],
    children: [
      { label: 'Facturación', path: '/panel/billing', roles: ['hotel_admin'] },
      { label: 'Caja', path: '/panel/caja', roles: ['hotel_admin'] },
      { label: 'Gastos', path: '/panel/gastos', roles: ['hotel_admin'] },
      { label: 'Reportes', path: '/panel/reports', roles: ['hotel_admin'] },
      { label: 'Night Audit', path: '/panel/night-audit', roles: ['hotel_admin'] },
      { label: 'Registro Viajeros', path: '/panel/registro-viajeros', roles: ['hotel_admin'] },
    ]
  },
  {
    label: 'Ventas', icon: '🔗', roles: ['hotel_admin'],
    children: [
      { label: 'Channel Manager', path: '/panel/channel-manager', roles: ['hotel_admin'] },
      { label: 'Grupos', path: '/panel/groups', roles: ['hotel_admin'] },
      { label: 'Paquetes', path: '/panel/packages', roles: ['hotel_admin'] },
      { label: 'Opiniones', path: '/panel/opiniones', roles: ['hotel_admin', 'receptionist'] },
    ]
  },
  {
    label: 'Configuración', icon: '⚙️', roles: ['hotel_admin'],
    children: [
      { label: 'Configuración', path: '/panel/settings', roles: ['hotel_admin'] },
      { label: 'Envíos Auto', path: '/panel/auto-messages', roles: ['hotel_admin'] },
      { label: 'Cerraduras', path: '/panel/cerraduras', roles: ['hotel_admin'] },
      { label: 'Dispositivos', path: '/panel/devices', roles: ['hotel_admin'] },
      { label: 'Soporte', path: '/panel/support', roles: ['hotel_admin', 'receptionist'] },
    ]
  },
]

const visibleItems = computed(() => {
  const role = auth.userRole
  return nonavItems
    .filter((item: any) => {
      if (item.children) return item.children.some((c: any) => c.roles.includes(role as any))
      return item.roles.includes(role as any)
    })
    .map((item: any) => {
      if (item.children) {
        const children = item.children.filter((c: any) => c.roles.includes(role as any))
        return { ...item, children, expanded: !collapsedSections.value.has(item.label) }
      }
      return item
    })
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
    dashboard: 'Dashboard',
    planning: 'Planificación',
    reservations: 'Reservas',
    rooms: 'Habitaciones',
    guests: 'Huéspedes',
    checkin: 'Check-in Digital',
    housekeeping: 'Housekeeping',
    maintenance: 'Mantenimiento',
    'channel-manager': 'Channel Manager',
    'booking-engine': 'Booking Engine',
    packages: 'Paquetes',
    groups: 'Grupos',
    'night-audit': 'Night Audit',
    billing: 'Facturación',
    gastos: 'Gastos',
    'registro-viajeros': 'Registro de Viajeros',
    reports: 'Reportes',
    opiniones: 'Opiniones',
    'auto-messages': 'Envíos Automáticos',
    caja: 'Caja',
    cerraduras: 'Cerraduras TTLock',
    devices: 'Dispositivos',
    support: 'Soporte',
    settings: 'Configuración',
  }
  return titles[route.name as string] ?? 'Panel'
})

function isActive(path: string) {
  if (path === '/panel') return route.path === '/panel'
  return route.path.startsWith(path)
}

function handleLogout() {
  auth.logout()
  router.push('/login')
}
</script>
