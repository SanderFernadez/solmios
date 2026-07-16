<template>
  <div>
    <!-- Header -->
    <div class="flex items-center justify-between mb-6">
      <div>
        <h2 class="text-xl font-black text-navy">Auditoría</h2>
        <p class="text-sm text-text-muted mt-0.5">Log de actividad global · Todas las acciones en la plataforma</p>
      </div>
      <div class="flex gap-2">
        <button class="px-4 py-2 bg-navy text-white text-sm font-bold rounded-xl hover:bg-navy-light transition-colors cursor-pointer">
          Exportar CSV
        </button>
      </div>
    </div>

    <!-- KPIs -->
    <div class="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
      <div class="bg-white rounded-xl p-4 border border-border">
        <div class="text-[10px] font-bold text-text-muted uppercase">Eventos Hoy</div>
        <div class="text-2xl font-black text-navy mt-1">1,247</div>
      </div>
      <div class="bg-white rounded-xl p-4 border border-border">
        <div class="text-[10px] font-bold text-text-muted uppercase">Logins</div>
        <div class="text-2xl font-black text-navy mt-1">89</div>
      </div>
      <div class="bg-white rounded-xl p-4 border border-border">
        <div class="text-[10px] font-bold text-text-muted uppercase">Errores</div>
        <div class="text-2xl font-black text-coral mt-1">3</div>
      </div>
      <div class="bg-white rounded-xl p-4 border border-border">
        <div class="text-[10px] font-bold text-text-muted uppercase">Retención</div>
        <div class="text-2xl font-black text-teal mt-1">90 días</div>
      </div>
    </div>

    <!-- Filters -->
    <div class="bg-white rounded-2xl border border-border p-4 mb-6">
      <div class="flex flex-wrap gap-3 items-center">
        <input v-model="searchQuery" type="text" placeholder="Buscar por usuario, hotel, acción..." class="px-4 py-2 rounded-xl border border-border text-sm focus:outline-none focus:border-cyan min-w-[280px]" />
        <select v-model="filterAction" class="px-4 py-2 rounded-xl border border-border text-sm font-bold cursor-pointer">
          <option value="all">Todas las acciones</option>
          <option value="login">Login / Logout</option>
          <option value="reservation">Reservas</option>
          <option value="billing">Facturación</option>
          <option value="settings">Configuración</option>
          <option value="user">Usuarios</option>
          <option value="hotel">Hoteles</option>
          <option value="system">Sistema</option>
        </select>
        <select v-model="filterHotel" class="px-4 py-2 rounded-xl border border-border text-sm font-bold cursor-pointer">
          <option value="all">Todos los hoteles</option>
          <option v-for="h in hotelList" :key="h" :value="h">{{ h }}</option>
        </select>
        <select v-model="filterDate" class="px-4 py-2 rounded-xl border border-border text-sm font-bold cursor-pointer">
          <option value="today">Hoy</option>
          <option value="yesterday">Ayer</option>
          <option value="week">Esta semana</option>
          <option value="month">Este mes</option>
        </select>
        <span class="text-xs text-text-muted">{{ filteredLogs.length }} resultados</span>
      </div>
    </div>

    <!-- Audit Table -->
    <div class="bg-white rounded-2xl border border-border overflow-hidden">
      <div class="overflow-x-auto">
        <table class="w-full">
          <thead>
            <tr class="border-b border-border bg-surface/50">
              <th class="text-left py-3 px-4 text-[10px] font-bold text-text-muted uppercase">Fecha/Hora</th>
              <th class="text-left py-3 px-4 text-[10px] font-bold text-text-muted uppercase">Usuario</th>
              <th class="text-left py-3 px-4 text-[10px] font-bold text-text-muted uppercase">Hotel</th>
              <th class="text-left py-3 px-4 text-[10px] font-bold text-text-muted uppercase">Acción</th>
              <th class="text-left py-3 px-4 text-[10px] font-bold text-text-muted uppercase">Categoría</th>
              <th class="text-left py-3 px-4 text-[10px] font-bold text-text-muted uppercase">Detalle</th>
              <th class="text-left py-3 px-4 text-[10px] font-bold text-text-muted uppercase">IP</th>
            </tr>
          </thead>
          <tbody>
            <tr v-for="log in filteredLogs" :key="log.id" class="border-b border-border/50 hover:bg-surface/50 transition-colors">
              <td class="py-3 px-4">
                <div class="text-xs font-bold text-navy">{{ log.date }}</div>
                <div class="text-[10px] text-text-muted">{{ log.time }}</div>
              </td>
              <td class="py-3 px-4">
                <div class="flex items-center gap-2">
                  <div class="w-7 h-7 rounded-full flex items-center justify-center text-[9px] font-bold" :class="log.roleColor">{{ log.initials }}</div>
                  <div>
                    <div class="text-xs font-bold text-navy">{{ log.user }}</div>
                    <div class="text-[9px] text-text-muted">{{ log.role }}</div>
                  </div>
                </div>
              </td>
              <td class="py-3 px-4">
                <span class="text-xs font-bold text-navy">{{ log.hotel }}</span>
              </td>
              <td class="py-3 px-4">
                <span class="text-[10px] font-bold px-2 py-0.5 rounded-full" :class="log.actionClass">
                  {{ log.action }}
                </span>
              </td>
              <td class="py-3 px-4">
                <span class="text-[10px] font-bold px-2 py-0.5 rounded-full" :class="log.categoryClass">
                  {{ log.category }}
                </span>
              </td>
              <td class="py-3 px-4 text-xs text-text-muted max-w-[250px] truncate">{{ log.detail }}</td>
              <td class="py-3 px-4 text-[10px] text-text-muted font-mono">{{ log.ip }}</td>
            </tr>
          </tbody>
        </table>
      </div>
      <!-- Pagination -->
      <div class="flex items-center justify-between p-4 border-t border-border">
        <span class="text-xs text-text-muted">Mostrando 1-{{ filteredLogs.length }} de {{ logs.length }}</span>
        <div class="flex gap-1">
          <button class="w-8 h-8 rounded-lg border border-border text-xs font-bold hover:bg-surface transition-colors cursor-pointer">1</button>
          <button class="w-8 h-8 rounded-lg bg-navy text-white text-xs font-bold cursor-pointer">2</button>
          <button class="w-8 h-8 rounded-lg border border-border text-xs font-bold hover:bg-surface transition-colors cursor-pointer">3</button>
          <button class="w-8 h-8 rounded-lg border border-border text-xs font-bold hover:bg-surface transition-colors cursor-pointer">→</button>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, onMounted } from 'vue'
import { AuditLogService } from '@/services/AuditLog.service'

const searchQuery = ref('')
const filterAction = ref('all')
const filterHotel = ref('all')
const filterDate = ref('today')

const ACTION_LABEL: Record<string, string> = { login: 'Login', logout: 'Logout', create: 'Crear', update: 'Editar', delete: 'Eliminar', sync: 'Sync' }

const logs = ref<any[]>([])

onMounted(async () => {
  try {
    const { data } = await AuditLogService.list()
    logs.value = data.map((l: any) => {
      const dt = String(l.createdAt || '').replace('T', ' ')
      return {
        id: l.id,
        date: dt.slice(0, 10),
        time: dt.slice(11, 19),
        user: l.userName ?? 'Sistema',
        initials: (l.userName ?? 'S').split(' ').map((p: string) => p[0]).slice(0, 2).join(''),
        role: '', roleColor: 'bg-cyan/20 text-cyan',
        hotel: '',
        action: ACTION_LABEL[l.accion] ?? l.accion,
        actionClass: 'bg-teal/10 text-teal',
        category: l.entidad ? (l.entidad.charAt(0).toUpperCase() + l.entidad.slice(1)) : 'Sistema',
        categoryClass: 'bg-navy/5 text-navy',
        detail: l.detalle ?? '',
        ip: l.ip ?? '',
      }
    })
  } catch { /* silent */ }
})

const hotelList = computed(() => [...new Set(logs.value.map((l: any) => l.hotel).filter(Boolean))])

const filteredLogs = computed(() => {
  return logs.value.filter((log: any) => {
    if (searchQuery.value && !log.user.toLowerCase().includes(searchQuery.value.toLowerCase()) && !log.detail.toLowerCase().includes(searchQuery.value.toLowerCase())) return false
    if (filterAction.value !== 'all' && log.category.toLowerCase() !== filterAction.value) return false
    if (filterHotel.value !== 'all' && log.hotel !== filterHotel.value) return false
    return true
  })
})
</script>
