<template>
  <div>
    <div class="flex items-center justify-between mb-6">
      <div>
        <h2 class="text-xl font-black text-navy">Dispositivos Conectados</h2>
        <p class="text-sm text-text-muted mt-0.5">Sesiones activas · Control de acceso</p>
      </div>
      <div class="flex items-center gap-3">
        <span class="text-xs font-bold px-3 py-1 rounded-full bg-blue/10 text-blue">{{ activeSessions }} sesiones activas</span>
        <button @click="revokeAll" class="px-4 py-2 bg-coral text-white text-sm font-bold rounded-full hover:shadow-lg transition-all cursor-pointer">
          Cerrar Todas las Sesiones
        </button>
      </div>
    </div>

    <!-- KPIs -->
    <div class="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
      <div class="rounded-[20px] border border-border bg-white shadow-(--shadow-card) p-4 transition-transform duration-300 hover:-translate-y-0.5">
        <div class="text-[10px] font-bold text-text-muted uppercase">Sesiones Activas</div>
        <div class="text-2xl font-black text-navy mt-1">{{ activeSessions }}</div>
      </div>
      <div class="rounded-[20px] border border-border bg-white shadow-(--shadow-card) p-4 transition-transform duration-300 hover:-translate-y-0.5">
        <div class="text-[10px] font-bold text-text-muted uppercase">Usuarios Conectados</div>
        <div class="text-2xl font-black text-navy mt-1">{{ uniqueUsers }}</div>
      </div>
      <div class="rounded-[20px] border border-border bg-white shadow-(--shadow-card) p-4 transition-transform duration-300 hover:-translate-y-0.5">
        <div class="text-[10px] font-bold text-text-muted uppercase">Dispositivos Móviles</div>
        <div class="text-2xl font-black text-navy mt-1">{{ mobileCount }}</div>
      </div>
      <div class="rounded-[20px] border border-border bg-white shadow-(--shadow-card) p-4 transition-transform duration-300 hover:-translate-y-0.5">
        <div class="text-[10px] font-bold text-text-muted uppercase">Último Acceso</div>
        <div class="text-2xl font-black text-teal mt-1">Ahora</div>
      </div>
    </div>

    <!-- Active Sessions -->
    <div class="rounded-[20px] border border-border bg-white shadow-(--shadow-card) p-6 mb-6">
      <div class="flex items-center justify-between mb-4">
        <h2 class="text-lg font-black text-navy">Sesiones Activas</h2>
        <div class="flex gap-2">
          <select v-model="filterRole" class="px-3 py-1.5 border border-border rounded-full text-xs font-bold text-navy cursor-pointer">
            <option value="all">Todos los roles</option>
            <option value="hotel_admin">Admin</option>
            <option value="receptionist">Recepción</option>
            <option value="super_admin">Super Admin</option>
          </select>
          <select v-model="filterDevice" class="px-3 py-1.5 border border-border rounded-full text-xs font-bold text-navy cursor-pointer">
            <option value="all">Todos los dispositivos</option>
            <option value="desktop">Escritorio</option>
            <option value="mobile">Móvil</option>
            <option value="tablet">Tablet</option>
          </select>
        </div>
      </div>
        <div class="overflow-x-auto">
          <table class="w-full">
            <thead>
              <tr class="border-b border-border">
                <th class="text-left py-3 text-[10px] font-bold text-text-muted uppercase">Usuario</th>
                <th class="text-left py-3 text-[10px] font-bold text-text-muted uppercase">Rol</th>
                <th class="text-left py-3 text-[10px] font-bold text-text-muted uppercase">Dispositivo</th>
                <th class="text-left py-3 text-[10px] font-bold text-text-muted uppercase">Navegador</th>
                <th class="text-left py-3 text-[10px] font-bold text-text-muted uppercase">SO</th>
                <th class="text-left py-3 text-[10px] font-bold text-text-muted uppercase">IP</th>
                <th class="text-left py-3 text-[10px] font-bold text-text-muted uppercase">Móvil</th>
                <th class="text-left py-3 text-[10px] font-bold text-text-muted uppercase">Último Acceso</th>
                <th class="text-right py-3 text-[10px] font-bold text-text-muted uppercase">Acción</th>
              </tr>
            </thead>
            <tbody>
              <tr v-for="session in filteredSessions" :key="session.id" class="border-b border-border/50 hover:bg-surface/50 transition-colors">
                <td class="py-3">
                  <div class="flex items-center gap-3">
                    <div class="w-9 h-9 rounded-full flex items-center justify-center text-xs font-bold" :class="session.avatarClass">
                      {{ session.initials }}
                    </div>
                    <div>
                      <div class="text-sm font-bold text-navy">{{ session.user }}</div>
                      <div class="text-[10px] text-text-muted">{{ session.email }}</div>
                    </div>
                  </div>
                </td>
                <td class="py-3">
                  <span class="text-[10px] font-bold px-2 py-0.5 rounded-full" :class="session.roleClass">
                    {{ session.role }}
                  </span>
                </td>
                <td class="py-3 text-xs">
                  <div class="flex items-center gap-1.5">
                    <span class="w-3.5 h-3.5 text-text-muted shrink-0" v-html="session.isMobile ? ICON_MOBILE : ICON_DESKTOP"></span>
                    <span class="text-navy">{{ session.device }}</span>
                  </div>
                </td>
                <td class="py-3 text-xs text-navy">{{ session.browser }}</td>
                <td class="py-3 text-xs text-text-muted">{{ session.os }}</td>
                <td class="py-3 text-xs text-text-muted font-mono">{{ session.ip }}</td>
                <td class="py-3">
                  <span class="text-[10px] font-bold px-2 py-0.5 rounded-full" :class="session.isMobile ? 'bg-cyan/10 text-cyan' : 'bg-surface text-text-muted'">
                    {{ session.isMobile ? 'Sí' : 'No' }}
                  </span>
                </td>
                <td class="py-3 text-xs text-text-muted">{{ session.lastAccess }}</td>
                <td class="py-3 text-right">
                  <button @click="revokeSession(session.id)" class="text-[11px] font-bold text-coral hover:text-navy transition-colors cursor-pointer">
                    Revocar
                  </button>
                </td>
              </tr>
            </tbody>
          </table>
        </div>
      </div>

      <!-- Session History -->
      <div class="rounded-[20px] border border-border bg-white shadow-(--shadow-card) p-6">
        <div class="flex items-center justify-between mb-4">
          <h2 class="text-lg font-black text-navy">Historial de Sesiones</h2>
          <div class="flex items-center gap-2">
            <span class="text-[10px] text-text-muted">Últimos 30 días</span>
            <button class="text-xs font-bold text-cyan hover:underline cursor-pointer">Exportar</button>
          </div>
        </div>
        <div class="overflow-x-auto">
          <table class="w-full">
            <thead>
              <tr class="border-b border-border">
                <th class="text-left py-3 text-[10px] font-bold text-text-muted uppercase">Usuario</th>
                <th class="text-left py-3 text-[10px] font-bold text-text-muted uppercase">Acción</th>
                <th class="text-left py-3 text-[10px] font-bold text-text-muted uppercase">Dispositivo</th>
                <th class="text-left py-3 text-[10px] font-bold text-text-muted uppercase">IP</th>
                <th class="text-left py-3 text-[10px] font-bold text-text-muted uppercase">Ubicación</th>
                <th class="text-left py-3 text-[10px] font-bold text-text-muted uppercase">Fecha</th>
              </tr>
            </thead>
            <tbody>
              <tr v-for="log in sessionHistory" :key="log.id" class="border-b border-border/50">
                <td class="py-3 text-sm font-bold text-navy">{{ log.user }}</td>
                <td class="py-3">
                  <span class="text-[10px] font-bold px-2 py-0.5 rounded-full" :class="log.actionClass">{{ log.action }}</span>
                </td>
                <td class="py-3 text-xs text-navy flex items-center gap-1.5">
                  <span class="w-3.5 h-3.5 text-text-muted shrink-0" v-html="ICON_DESKTOP"></span> {{ log.device }}
                </td>
                <td class="py-3 text-xs text-text-muted font-mono">{{ log.ip }}</td>
                <td class="py-3 text-xs text-text-muted">{{ log.location }}</td>
                <td class="py-3 text-xs text-text-muted">{{ log.date }}</td>
              </tr>
            </tbody>
          </table>
        </div>
      </div>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, onMounted } from 'vue'
import { OperationsService } from '@/services/Operations.service'
import { useAuthStore } from '@/stores/auth.store'
import { useToast } from '@/composables/useToast'

const ICON_SIGNAL = '<svg viewBox="0 0 24 24" class="w-full h-full" fill="none" stroke="currentColor" stroke-width="1.6"><path stroke-linecap="round" stroke-linejoin="round" d="M9 9a3 3 0 0 1 4.243 0M6.343 6.343a8 8 0 0 1 11.314 0M3.515 3.515a12 12 0 0 1 16.97 0M12 18.01v.01"/></svg>'
const ICON_USERS = '<svg viewBox="0 0 24 24" class="w-full h-full" fill="none" stroke="currentColor" stroke-width="1.6"><path stroke-linecap="round" stroke-linejoin="round" d="M15 19.128a9.38 9.38 0 0 0 2.625.372 9.337 9.337 0 0 0 4.121-.952 4.125 4.125 0 0 0-7.533-2.493M15 19.128v-.003c0-1.113-.285-2.16-.786-3.07M15 19.128v.106A12.318 12.318 0 0 1 8.624 21c-2.331 0-4.512-.645-6.374-1.766l-.001-.109a6.375 6.375 0 0 1 11.964-3.07M12 6.375a3.375 3.375 0 1 1-6.75 0 3.375 3.375 0 0 1 6.75 0Zm8.25 2.25a2.625 2.625 0 1 1-5.25 0 2.625 2.625 0 0 1 5.25 0Z"/></svg>'
const ICON_MOBILE = '<svg viewBox="0 0 24 24" class="w-full h-full" fill="none" stroke="currentColor" stroke-width="1.6"><path stroke-linecap="round" stroke-linejoin="round" d="M10.5 1.5H8.25A2.25 2.25 0 0 0 6 3.75v16.5a2.25 2.25 0 0 0 2.25 2.25h7.5A2.25 2.25 0 0 0 18 20.25V3.75a2.25 2.25 0 0 0-2.25-2.25H13.5m-3 0V3h3V1.5m-3 0h3m-3 18h3"/></svg>'
const ICON_DESKTOP = '<svg viewBox="0 0 24 24" class="w-full h-full" fill="none" stroke="currentColor" stroke-width="1.6"><path stroke-linecap="round" stroke-linejoin="round" d="M9 17.25v1.007a3 3 0 0 1-.879 2.122L7.5 21h9l-.621-.621A3 3 0 0 1 15 18.257V17.25m6-12V15a2.25 2.25 0 0 1-2.25 2.25H5.25A2.25 2.25 0 0 1 3 15V5.25m18 0A2.25 2.25 0 0 0 18.75 3H5.25A2.25 2.25 0 0 0 3 5.25m18 0V12a2.25 2.25 0 0 1-2.25 2.25H5.25A2.25 2.25 0 0 1 3 12V5.25"/></svg>'
const ICON_CLOCK = '<svg viewBox="0 0 24 24" class="w-full h-full" fill="none" stroke="currentColor" stroke-width="1.6"><path stroke-linecap="round" stroke-linejoin="round" d="M12 6v6l4 2M21 12a9 9 0 1 1-18 0 9 9 0 0 1 18 0Z"/></svg>'

const auth = useAuthStore()
const toast = useToast()
const hotelId = computed(() => (auth.user?.hotelId && auth.user.hotelId !== 'platform' ? auth.user.hotelId : undefined))

const filterRole = ref('all')
const filterDevice = ref('all')

const sessions = ref<any[]>([])
const sessionHistory = ref<any[]>([])

onMounted(async () => {
  try {
    const { data } = await OperationsService.dispositivos(hotelId.value)
    sessions.value = data.map((d: any) => ({
      id: d.id,
      user: d.userName ?? '',
      initials: (d.userName ?? '').split(' ').map((p: string) => p[0]).slice(0, 2).join(''),
      email: '', role: '', roleClass: 'bg-cyan/10 text-cyan', avatarClass: 'bg-cyan/20 text-cyan',
      device: d.device ?? '',
      browser: d.browser ?? '', os: d.os ?? '', ip: d.ip ?? '',
      isMobile: d.isMobile === 1, lastAccess: d.lastActivity ?? '',
    }))
  } catch { toast.error("Error al cargar datos") }
})

const activeSessions = computed(() => sessions.value.filter(s =>
  s.lastAccess === 'Ahora' || s.lastAccess.startsWith('Hace')
).length)

const uniqueUsers = computed(() => new Set(sessions.value.map(s => s.email)).size)
const mobileCount = computed(() => sessions.value.filter(s => s.isMobile).length)

const filteredSessions = computed(() => sessions.value.filter(s => {
  if (filterRole.value !== 'all') {
    const roleMap: Record<string, string> = { 'hotel_admin': 'Hotel Admin', 'receptionist': 'Recepción', 'super_admin': 'Super Admin' }
    if (s.role !== roleMap[filterRole.value]) return false
  }
  if (filterDevice.value !== 'all') {
    const deviceMap: Record<string, string> = { 'desktop': 'false', 'mobile': 'true', 'tablet': 'true' }
    const isMobile = deviceMap[filterDevice.value] === 'true'
    if (filterDevice.value === 'tablet') return s.device.includes('iPad') || s.device.includes('Tablet')
    if (s.isMobile !== isMobile) return false
  }
  return true
}))

function revokeSession(id: number) {
  sessions.value = sessions.value.filter(s => s.id !== id)
}

function revokeAll() {
  sessions.value = []
}
</script>
