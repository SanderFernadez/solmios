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
                    <span>{{ session.deviceIcon }}</span>
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
                  <span>{{ log.deviceIcon }}</span> {{ log.device }}
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
      device: d.device ?? '', deviceIcon: d.icon ?? '🖥️',
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
