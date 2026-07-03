<template>
  <div class="flex min-h-screen bg-surface">
    <!-- Sidebar -->
    <aside class="w-64 bg-navy text-white flex flex-col flex-shrink-0 fixed h-full z-20">
      <!-- Logo -->
      <div class="h-16 flex items-center gap-3 px-5 border-b border-white/10">
        <div class="w-9 h-9 rounded-lg bg-gradient-to-br from-cyan to-blue flex items-center justify-center font-black text-lg shadow-lg">S</div>
        <div>
          <div class="font-black text-lg leading-tight">Solmi<span class="text-cyan">OS</span></div>
          <div class="text-[9px] font-bold tracking-[2px] text-gray-400 uppercase">Super Admin</div>
        </div>
      </div>

      <!-- Navigation -->
      <nav class="flex-1 py-4 px-3 space-y-1 overflow-y-auto">
        <router-link
          v-for="item in navItems"
          :key="item.path"
          :to="item.path"
          class="flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-semibold transition-all cursor-pointer"
          :class="isActive(item.path) ? 'bg-white/15 text-white' : 'text-gray-400 hover:bg-white/5 hover:text-white'"
        >
          <span class="text-lg">{{ item.icon }}</span>
          <span>{{ item.label }}</span>
          <span
            v-if="item.badge"
            class="ml-auto bg-coral/20 text-coral text-[10px] font-bold px-2 py-0.5 rounded-full"
          >
            {{ item.badge }}
          </span>
        </router-link>
      </nav>

      <!-- PC-2 Multi-property: Hotel Switcher (contexto de hotel activo para super_admin) -->
      <div class="border-t border-white/10 py-2 px-3">
        <HotelSwitcher />
      </div>

      <!-- Platform Status -->
      <div class="p-4 border-t border-white/10">
        <div class="bg-white/5 rounded-xl p-3 mb-3">
          <div class="flex items-center justify-between mb-2">
            <span class="text-[10px] font-bold text-gray-400 uppercase">Plataforma</span>
            <span class="w-2 h-2 bg-teal rounded-full animate-pulse"></span>
          </div>
          <div class="text-xs text-gray-300">Hoteles: <span class="font-bold text-white">{{ stats.hoteles || 1 }} activos</span></div>
        </div>
        <div class="flex items-center gap-3">
          <div class="w-9 h-9 rounded-full bg-coral/30 flex items-center justify-center text-sm font-bold">SA</div>
          <div class="flex-1 min-w-0">
            <div class="text-sm font-bold truncate">{{ auth.user?.name ?? 'Super Admin' }}</div>
            <div class="text-[10px] text-cyan">Plataforma SolmiOS</div>
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
    <div class="flex-1 ml-64 flex flex-col">
      <!-- Header -->
      <header class="h-16 bg-white border-b border-border flex items-center justify-between px-6 sticky top-0 z-10 shadow-sm">
        <div>
          <h1 class="text-lg font-black text-navy">{{ pageTitle }}</h1>
        </div>
        <div class="flex items-center gap-4">
          <!-- Search -->
          <div class="relative">
            <input type="text" placeholder="Buscar hoteles, usuarios..." class="w-72 h-9 pl-9 pr-4 rounded-lg border border-border text-sm bg-surface focus:outline-none focus:border-cyan focus:ring-2 focus:ring-cyan/20 transition-all" />
            <svg class="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-text-muted" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
            </svg>
          </div>

          <!-- Notifications -->
          <button class="relative p-2 rounded-lg hover:bg-surface transition-colors cursor-pointer">
            <svg class="w-5 h-5 text-text-secondary" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M15 17h5l-1.405-1.405A2.032 2.032 0 0118 14.158V11a6.002 6.002 0 00-4-5.659V5a2 2 0 10-4 0v.341C7.67 6.165 6 8.388 6 11v3.159c0 .538-.214 1.055-.595 1.436L4 17h5m6 0v1a3 3 0 11-6 0v-1m6 0H9" />
            </svg>
            <span class="absolute top-1.5 right-1.5 w-2 h-2 bg-coral rounded-full"></span>
          </button>

          <!-- Quick Actions -->
          <button class="bg-cyan text-navy font-extrabold text-sm px-4 py-2 rounded-lg hover:shadow-lg transition-all cursor-pointer">
            + Nuevo Hotel
          </button>

          <!-- User Menu (Configuración / Cambiar contraseña / Salir) -->
          <UserMenu />
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
import { computed, ref, onMounted } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { useAuthStore } from '@/stores/auth.store'
import { http } from '@/services/http'
import HotelSwitcher from '@/components/features/core-pms/HotelSwitcher.vue'
import UserMenu from '@/components/features/core-pms/UserMenu.vue'

const route = useRoute()
const router = useRouter()
const auth = useAuthStore()

const stats = ref<any>({})

onMounted(async () => {
  try {
    const r = await http.get<any>('/admin/hoteles')
    stats.value = { hoteles: r?.total ?? r?.data?.length ?? 1 }
  } catch {}
  try {
    const m = await http.get<any>('/admin/monitoring')
    stats.value = { ...stats.value, ...m }
  } catch {}
})

const navItems = computed(() => {
  const s = stats.value
  return [
    { path: '/admin', label: 'Dashboard', icon: '📊' },
    { path: '/admin/hotels', label: 'Hoteles', icon: '🏨', badge: s.hoteles || undefined },
    { path: '/admin/plans', label: 'Planes', icon: '💳' },
    { path: '/admin/subscriptions', label: 'Suscripciones', icon: '📋' },
    { path: '/admin/amenities', label: 'Amenities', icon: '✨' },
    { path: '/admin/support', label: 'Soporte', icon: '🎫', badge: s.ticketsAbiertos || undefined },
    { path: '/admin/billing', label: 'Facturación', icon: '💰' },
    { path: '/admin/analytics', label: 'Analytics', icon: '📈' },
    { path: '/admin/users', label: 'Usuarios', icon: '👤' },
    { path: '/admin/empleados', label: 'Empleados', icon: '👥' },
    { path: '/admin/monitoring', label: 'Monitoreo', icon: '🖥️' },
    { path: '/admin/audit', label: 'Auditoría', icon: '📋' },
    { path: '/admin/announcements', label: 'Anuncios', icon: '📢' },
    { path: '/admin/api-keys', label: 'API & Webhooks', icon: '🔑' },
    { path: '/admin/roles', label: 'Roles & Permisos', icon: '🔐' },
    { path: '/admin/settings', label: 'Configuración', icon: '⚙️' },
  ]
})

const pageTitle = computed(() => {
  const titles: Record<string, string> = {
    'super-admin': 'Dashboard',
    'super-admin-hotels': 'Gestión de Hoteles',
    'super-admin-plans': 'Planes de Suscripción',
    'super-admin-subscriptions': 'Suscripciones',
    'super-admin-amenities': 'Catálogo de Amenities',
    'super-admin-support': 'Soporte',
    'super-admin-billing': 'Facturación',
    'super-admin-analytics': 'Analytics',
    'super-admin-users': 'Usuarios',
    'super-admin-empleados': 'Gestión de Empleados',
    'super-admin-monitoring': 'Monitoreo del Sistema',
    'super-admin-audit': 'Auditoría',
    'super-admin-announcements': 'Anuncios & Comunicados',
    'super-admin-api-keys': 'API Keys & Webhooks',
    'super-admin-roles': 'Roles & Permisos',
    'super-admin-settings': 'Configuración',
  }
  return titles[route.name as string] ?? 'Super Admin'
})

function isActive(path: string) {
  if (path === '/admin') return route.path === '/admin'
  return route.path.startsWith(path)
}

async function handleLogout() {
  await auth.logout()
  router.push('/login')
}
</script>
