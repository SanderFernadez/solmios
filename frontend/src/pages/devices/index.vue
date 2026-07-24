<template>
  <div>
    <!-- Header -->
    <div class="flex items-center justify-between gap-3 flex-wrap mb-6">
      <div>
        <div class="flex items-center gap-2.5">
          <h2 class="text-xl font-black text-navy">Dispositivos Conectados</h2>
          <span class="inline-flex items-center gap-1.5 rounded-full bg-[#DCFCE7] px-2.5 py-1 text-[10px] font-extrabold uppercase text-[#16A34A]">
            <span class="relative flex h-1.5 w-1.5">
              <span class="absolute inline-flex h-full w-full animate-ping rounded-full bg-[#22C55E] opacity-60"></span>
              <span class="relative inline-flex h-1.5 w-1.5 rounded-full bg-[#22C55E]"></span>
            </span>
            En vivo
          </span>
        </div>
        <p class="text-sm text-text-muted mt-0.5">Sesiones activas · Control de acceso</p>
      </div>
      <button
        @click="revokeAll"
        :disabled="!sessions.length"
        class="flex items-center gap-1.5 px-5 py-2.5 bg-coral text-white text-sm font-extrabold rounded-full hover:shadow-lg transition-all cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed disabled:hover:shadow-none"
      >
        <span class="w-4 h-4 shrink-0" v-html="ICON_REVOKE"></span>
        Cerrar Todas las Sesiones
      </button>
    </div>

    <!-- KPIs -->
    <div class="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-4 mb-6">
      <KpiHeroCard label="Dispositivos Registrados" :value="sessions.length" icon="building" accent="blue"
        unit="Sesiones conocidas en el hotel" />
      <KpiHeroCard label="Sesiones Activas" :value="activeSessions" icon="checkin" accent="teal"
        unit="Conectadas en este momento" :progress="activeShare" />
      <KpiHeroCard label="Usuarios Conectados" :value="uniqueUsers" icon="users" accent="purple"
        unit="Personas distintas con sesión" />
      <KpiHeroCard label="Dispositivos Móviles" :value="mobileCount" icon="bookings" accent="amber"
        unit="Accesos desde celular o tablet" />
    </div>

    <!-- Sesiones Activas -->
    <SectionCard
      title="Sesiones Activas"
      :subtitle="`${filteredSessions.length} de ${sessions.length} sesión(es)`"
      body-class="p-0"
      class="mb-6"
    >
      <template #actions>
        <select v-model="filterRole" class="px-3 py-2 rounded-lg border border-white/15 bg-white/10 text-sm font-semibold text-white focus:outline-none focus:border-cyan cursor-pointer">
          <option class="text-navy" value="all">Todos los roles</option>
          <option class="text-navy" value="hotel_admin">Admin</option>
          <option class="text-navy" value="receptionist">Recepción</option>
          <option class="text-navy" value="super_admin">Super Admin</option>
          <option class="text-navy" value="housekeeper">Limpieza</option>
          <option class="text-navy" value="maintenance">Mantenimiento</option>
          <option class="text-navy" value="supervisor">Supervisor</option>
          <option class="text-navy" value="waiter">Mesero</option>
          <option class="text-navy" value="kitchen">Cocina</option>
        </select>
        <select v-model="filterDevice" class="px-3 py-2 rounded-lg border border-white/15 bg-white/10 text-sm font-semibold text-white focus:outline-none focus:border-cyan cursor-pointer">
          <option class="text-navy" value="all">Todos los dispositivos</option>
          <option class="text-navy" value="desktop">Escritorio</option>
          <option class="text-navy" value="mobile">Móvil</option>
          <option class="text-navy" value="tablet">Tablet</option>
        </select>
      </template>

      <!-- Skeleton -->
      <div v-if="loading" class="p-4 sm:p-5 space-y-3">
        <div v-for="i in 5" :key="i" class="h-12 animate-pulse rounded-lg bg-surface"></div>
      </div>

      <EmptyState
        v-else-if="!filteredSessions.length"
        :icon="ICON_SIGNAL_EMPTY"
        :title="hasSessionFilters ? 'Sin resultados' : 'No hay dispositivos conectados'"
        :message="hasSessionFilters
          ? 'Probá con otro rol o tipo de dispositivo.'
          : 'Cuando alguien del equipo inicie sesión, su dispositivo aparecerá acá.'"
      >
        <template #action>
          <button
            v-if="hasSessionFilters"
            @click="clearSessionFilters"
            class="px-5 py-2.5 rounded-full border border-border text-sm font-bold text-navy hover:bg-surface transition-colors cursor-pointer"
          >
            Limpiar filtros
          </button>
        </template>
      </EmptyState>

      <div v-else class="overflow-x-auto">
        <table class="w-full min-w-[900px] tbl-head">
          <thead>
            <tr>
              <th class="text-left px-4 py-3 text-[10px]">Usuario</th>
              <th class="text-left px-4 py-3 text-[10px]">Estado</th>
              <th class="text-left px-4 py-3 text-[10px]">Dispositivo</th>
              <th class="text-left px-4 py-3 text-[10px] hidden lg:table-cell">Navegador</th>
              <th class="text-left px-4 py-3 text-[10px] hidden xl:table-cell">SO</th>
              <th class="text-left px-4 py-3 text-[10px] hidden lg:table-cell">IP</th>
              <th class="text-left px-4 py-3 text-[10px]">Último Acceso</th>
              <th class="text-right px-4 py-3 text-[10px]">Acciones</th>
            </tr>
          </thead>
          <tbody>
            <tr
              v-for="session in filteredSessions"
              :key="session.id"
              class="border-b border-border/60 last:border-0 hover:bg-surface/50 transition-colors"
            >
              <td class="px-4 py-3">
                <div class="flex items-center gap-3">
                  <div class="grid h-9 w-9 shrink-0 place-items-center rounded-full text-xs font-black" :class="session.avatarClass">
                    {{ session.initials || '?' }}
                  </div>
                  <div class="min-w-0">
                    <div class="text-sm font-bold text-navy truncate">{{ session.user || 'Usuario sin identificar' }}</div>
                    <div v-if="session.email" class="text-[10px] text-text-muted truncate">{{ session.email }}</div>
                    <!-- Datos secundarios que se ocultan en pantallas chicas -->
                    <div v-if="session.browser || session.ip" class="mt-0.5 text-[10px] text-text-muted lg:hidden truncate">
                      <span v-if="session.browser">{{ session.browser }}</span>
                      <span v-if="session.browser && session.ip"> · </span>
                      <span v-if="session.ip" class="font-mono tabular-nums">{{ session.ip }}</span>
                    </div>
                    <span
                      v-if="session.role"
                      class="mt-1 inline-block rounded-full px-2 py-0.5 text-[10px] font-bold"
                      :class="session.roleClass"
                    >
                      {{ session.role }}
                    </span>
                  </div>
                </div>
              </td>
              <td class="px-4 py-3">
                <span
                  class="inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-[10px] font-bold"
                  :class="isOnline(session) ? 'bg-teal/10 text-teal' : 'bg-surface text-text-muted'"
                >
                  <span class="h-1.5 w-1.5 rounded-full" :class="isOnline(session) ? 'bg-teal' : 'bg-text-muted'"></span>
                  {{ isOnline(session) ? 'En línea' : 'Desconectado' }}
                </span>
              </td>
              <td class="px-4 py-3">
                <div class="flex items-center gap-1.5">
                  <span class="h-4 w-4 shrink-0 text-text-muted" v-html="session.isMobile ? ICON_MOBILE : ICON_DESKTOP"></span>
                  <span class="text-xs font-semibold text-navy">
                    {{ session.device || (session.isMobile ? 'Móvil' : 'Escritorio') }}
                  </span>
                </div>
              </td>
              <td class="px-4 py-3 text-xs text-navy hidden lg:table-cell">
                <span v-if="session.browser">{{ session.browser }}</span>
                <span v-else class="text-text-muted">Sin datos</span>
              </td>
              <td class="px-4 py-3 text-xs text-text-secondary hidden xl:table-cell">
                <span v-if="session.os">{{ session.os }}</span>
                <span v-else class="text-text-muted">Sin datos</span>
              </td>
              <td class="px-4 py-3 text-xs text-text-secondary font-mono tabular-nums hidden lg:table-cell">
                <span v-if="session.ip">{{ session.ip }}</span>
                <span v-else class="text-text-muted font-sans">Sin datos</span>
              </td>
              <td class="px-4 py-3 text-xs text-text-secondary tabular-nums whitespace-nowrap">
                <span v-if="session.lastAccess">{{ session.lastAccess }}</span>
                <span v-else class="text-text-muted">Sin registro</span>
              </td>
              <td class="px-4 py-3">
                <div class="flex items-center justify-end gap-1">
                  <button
                    @click="revokeSession(session.id)"
                    title="Revocar sesión"
                    class="grid h-8 w-8 place-items-center rounded-lg text-coral hover:bg-coral/10 transition-colors cursor-pointer"
                  >
                    <span class="h-4 w-4" v-html="ICON_REVOKE"></span>
                  </button>
                </div>
              </td>
            </tr>
          </tbody>
        </table>
      </div>
    </SectionCard>

    <!-- Historial de Sesiones -->
    <SectionCard
      title="Historial de Sesiones"
      subtitle="Últimos 30 días"
      body-class="p-0"
    >
      <template #actions>
        <button class="rounded-lg border border-white/15 bg-white/10 px-3 py-2 text-sm font-semibold text-white hover:bg-white/20 transition-colors cursor-pointer">
          Exportar
        </button>
      </template>

      <div v-if="loading" class="p-4 sm:p-5 space-y-3">
        <div v-for="i in 3" :key="i" class="h-10 animate-pulse rounded-lg bg-surface"></div>
      </div>

      <EmptyState
        v-else-if="!sessionHistory.length"
        :icon="ICON_CLOCK_EMPTY"
        title="Sin actividad registrada"
        message="Todavía no hay accesos en los últimos 30 días."
      />

      <div v-else class="overflow-x-auto">
        <table class="w-full min-w-[760px] tbl-head">
          <thead>
            <tr>
              <th class="text-left px-4 py-3 text-[10px]">Usuario</th>
              <th class="text-left px-4 py-3 text-[10px]">Acción</th>
              <th class="text-left px-4 py-3 text-[10px]">Dispositivo</th>
              <th class="text-left px-4 py-3 text-[10px] hidden lg:table-cell">IP</th>
              <th class="text-left px-4 py-3 text-[10px] hidden lg:table-cell">Ubicación</th>
              <th class="text-left px-4 py-3 text-[10px]">Fecha</th>
            </tr>
          </thead>
          <tbody>
            <tr
              v-for="log in sessionHistory"
              :key="log.id"
              class="border-b border-border/60 last:border-0 hover:bg-surface/50 transition-colors"
            >
              <td class="px-4 py-3">
                <div class="text-sm font-bold text-navy">{{ log.user || 'Usuario sin identificar' }}</div>
                <div v-if="log.ip || log.location" class="mt-0.5 text-[10px] text-text-muted lg:hidden">
                  <span v-if="log.ip" class="font-mono tabular-nums">{{ log.ip }}</span>
                  <span v-if="log.ip && log.location"> · </span>
                  <span v-if="log.location">{{ log.location }}</span>
                </div>
              </td>
              <td class="px-4 py-3">
                <span v-if="log.action" class="rounded-full px-2 py-0.5 text-[10px] font-bold" :class="log.actionClass">{{ log.action }}</span>
              </td>
              <td class="px-4 py-3">
                <div class="flex items-center gap-1.5">
                  <span class="h-4 w-4 shrink-0 text-text-muted" v-html="ICON_DESKTOP"></span>
                  <span class="text-xs font-semibold text-navy">{{ log.device || 'Escritorio' }}</span>
                </div>
              </td>
              <td class="px-4 py-3 text-xs text-text-secondary font-mono tabular-nums hidden lg:table-cell">
                <span v-if="log.ip">{{ log.ip }}</span>
                <span v-else class="text-text-muted font-sans">Sin datos</span>
              </td>
              <td class="px-4 py-3 text-xs text-text-secondary hidden lg:table-cell">
                <span v-if="log.location">{{ log.location }}</span>
                <span v-else class="text-text-muted">Sin datos</span>
              </td>
              <td class="px-4 py-3 text-xs text-text-secondary tabular-nums whitespace-nowrap">
                <span v-if="log.date">{{ log.date }}</span>
                <span v-else class="text-text-muted">Sin registro</span>
              </td>
            </tr>
          </tbody>
        </table>
      </div>
    </SectionCard>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, onMounted } from 'vue'
import { OperationsService } from '@/services/Operations.service'
import { useAuthStore } from '@/stores/auth.store'
import { useToast } from '@/composables/useToast'
import KpiHeroCard from '@/components/features/dashboard/KpiHeroCard.vue'
import SectionCard from '@/components/ui/SectionCard.vue'
import EmptyState from '@/components/ui/EmptyState.vue'

const ICON_MOBILE = '<svg viewBox="0 0 24 24" class="w-full h-full" fill="none" stroke="currentColor" stroke-width="1.6"><path stroke-linecap="round" stroke-linejoin="round" d="M10.5 1.5H8.25A2.25 2.25 0 0 0 6 3.75v16.5a2.25 2.25 0 0 0 2.25 2.25h7.5A2.25 2.25 0 0 0 18 20.25V3.75a2.25 2.25 0 0 0-2.25-2.25H13.5m-3 0V3h3V1.5m-3 0h3m-3 18h3"/></svg>'
const ICON_DESKTOP = '<svg viewBox="0 0 24 24" class="w-full h-full" fill="none" stroke="currentColor" stroke-width="1.6"><path stroke-linecap="round" stroke-linejoin="round" d="M9 17.25v1.007a3 3 0 0 1-.879 2.122L7.5 21h9l-.621-.621A3 3 0 0 1 15 18.257V17.25m6-12V15a2.25 2.25 0 0 1-2.25 2.25H5.25A2.25 2.25 0 0 1 3 15V5.25m18 0A2.25 2.25 0 0 0 18.75 3H5.25A2.25 2.25 0 0 0 3 5.25m18 0V12a2.25 2.25 0 0 1-2.25 2.25H5.25A2.25 2.25 0 0 1 3 12V5.25"/></svg>'
const ICON_REVOKE = '<svg viewBox="0 0 24 24" class="w-full h-full" fill="none" stroke="currentColor" stroke-width="1.8"><path stroke-linecap="round" stroke-linejoin="round" d="M15.75 9V5.25A2.25 2.25 0 0 0 13.5 3h-6a2.25 2.25 0 0 0-2.25 2.25v13.5A2.25 2.25 0 0 0 7.5 21h6a2.25 2.25 0 0 0 2.25-2.25V15M18 12H9m9 0-2.25-2.25M18 12l-2.25 2.25"/></svg>'
const ICON_SIGNAL_EMPTY = '<svg viewBox="0 0 24 24" class="h-8 w-8" fill="none" stroke="currentColor" stroke-width="1.5"><path stroke-linecap="round" stroke-linejoin="round" d="M9 9a3 3 0 0 1 4.243 0M6.343 6.343a8 8 0 0 1 11.314 0M3.515 3.515a12 12 0 0 1 16.97 0M12 18.01v.01"/></svg>'
const ICON_CLOCK_EMPTY = '<svg viewBox="0 0 24 24" class="h-8 w-8" fill="none" stroke="currentColor" stroke-width="1.5"><path stroke-linecap="round" stroke-linejoin="round" d="M12 6v6l4 2M21 12a9 9 0 1 1-18 0 9 9 0 0 1 18 0Z"/></svg>'

const auth = useAuthStore()
const toast = useToast()
const hotelId = computed(() => (auth.user?.hotelId && auth.user.hotelId !== 'platform' ? auth.user.hotelId : undefined))

const filterRole = ref('all')
const filterDevice = ref('all')
const loading = ref(true)

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
  finally { loading.value = false }
})

// Una sesión se considera "en línea" si su último acceso es reciente.
function isOnline(s: any) {
  return s.lastAccess === 'Ahora' || String(s.lastAccess ?? '').startsWith('Hace')
}

const activeSessions = computed(() => sessions.value.filter(isOnline).length)

const activeShare = computed(() =>
  sessions.value.length ? Math.round((activeSessions.value / sessions.value.length) * 100) : 0
)

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

const hasSessionFilters = computed(() => filterRole.value !== 'all' || filterDevice.value !== 'all')

function clearSessionFilters() {
  filterRole.value = 'all'
  filterDevice.value = 'all'
}

function revokeSession(id: number) {
  sessions.value = sessions.value.filter(s => s.id !== id)
}

function revokeAll() {
  sessions.value = []
}
</script>

<style scoped></style>
