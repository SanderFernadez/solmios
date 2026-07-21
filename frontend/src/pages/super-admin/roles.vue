<template>
  <div>
    <!-- Header -->
    <div class="flex items-center justify-between mb-6">
      <div>
        <h2 class="text-xl font-black text-navy">Roles & Permisos</h2>
        <p class="text-sm text-text-muted mt-0.5">Define qué puede hacer cada rol en la plataforma</p>
      </div>
      <button @click="showCreateRole = true" class="px-4 py-2 bg-navy text-white text-sm font-bold rounded-xl cursor-pointer">
        + Crear Rol
      </button>
    </div>

    <!-- Role Cards -->
    <div class="grid md:grid-cols-3 gap-4 mb-6">
      <div v-for="role in roles" :key="role.id"
        class="bg-white rounded-2xl border-2 p-5 cursor-pointer transition-all hover:shadow-lg"
        :class="selectedRole?.id === role.id ? 'border-navy shadow-md' : 'border-border'"
        @click="selectedRole = role">
        <div class="flex items-center justify-between mb-3">
          <div class="flex items-center gap-3">
            <div class="w-10 h-10 rounded-xl flex items-center justify-center text-lg" :class="role.color">{{ role.icon }}</div>
            <div>
              <div class="text-sm font-black text-navy">{{ role.name }}</div>
              <div class="text-[10px] text-text-muted">{{ role.users }} usuarios</div>
            </div>
          </div>
          <span v-if="role.system" class="text-[8px] font-bold px-1.5 py-0.5 rounded bg-navy/10 text-navy uppercase">Sistema</span>
        </div>
        <div class="flex flex-wrap gap-1">
          <span v-for="perm in role.permissions.slice(0, 5)" :key="perm" class="text-[8px] font-bold px-1.5 py-0.5 rounded-full bg-surface text-text-muted">{{ perm }}</span>
          <span v-if="role.permissions.length > 5" class="text-[8px] font-bold text-text-muted">+{{ role.permissions.length - 5 }}</span>
        </div>
      </div>
      <!-- Add Role Card -->
      <button @click="showCreateRole = true" class="bg-white rounded-2xl border-2 border-dashed border-border p-5 flex flex-col items-center justify-center min-h-[120px] hover:border-cyan transition-colors cursor-pointer">
        <span class="text-2xl text-text-muted mb-1">+</span>
        <span class="text-xs font-bold text-text-muted">Crear Nuevo Rol</span>
      </button>
    </div>

    <!-- Permission Matrix -->
    <div v-if="selectedRole" class="bg-white rounded-2xl border border-border overflow-hidden">
      <div class="px-5 py-4 bg-navy flex items-center justify-between">
        <div>
          <h3 class="font-extrabold text-white">Permisos — {{ selectedRole.name }}</h3>
          <p class="text-[10px] text-white/60">Marca los permisos que tendrá este rol</p>
        </div>
        <div class="flex gap-2">
          <button @click="selectAll" class="px-3 py-1.5 text-[10px] font-bold rounded-lg bg-white/10 text-white hover:bg-white/20 hover:text-white transition-colors cursor-pointer">Seleccionar Todo</button>
          <button @click="deselectAll" class="px-3 py-1.5 text-[10px] font-bold rounded-lg bg-white/10 text-white hover:bg-white/20 hover:text-white transition-colors cursor-pointer">Quitar Todo</button>
        </div>
      </div>

      <!-- Permission Matrix by Module -->
      <div class="overflow-x-auto">
        <table class="w-full tbl-head">
          <thead>
            <tr class="border-b border-border bg-navy/5">
              <th class="text-left py-3 px-4 text-xs font-black text-navy">Módulo / Categoría</th>
              <th class="text-center py-3 px-3 text-[10px] font-bold text-text-muted uppercase">Ver</th>
              <th class="text-center py-3 px-3 text-[10px] font-bold text-text-muted uppercase">Crear</th>
              <th class="text-center py-3 px-3 text-[10px] font-bold text-text-muted uppercase">Editar</th>
              <th class="text-center py-3 px-3 text-[10px] font-bold text-text-muted uppercase">Eliminar</th>
              <th class="text-center py-3 px-3 text-[10px] font-bold text-text-muted uppercase">Exportar</th>
              <th class="text-center py-3 px-3 text-[10px] font-bold text-text-muted uppercase">Admin</th>
            </tr>
          </thead>
          <tbody>
            <template v-for="category in permissionCategories" :key="category.name">
              <!-- Category Header -->
              <tr class="border-b border-border">
                <td colspan="7" class="py-2 px-4 bg-surface/30">
                  <div class="flex items-center gap-2">
                    <span class="text-lg">{{ category.icon }}</span>
                    <span class="text-xs font-black text-navy">{{ category.name }}</span>
                  </div>
                </td>
              </tr>
              <!-- Permissions -->
              <tr v-for="perm in category.permissions" :key="perm.key" class="border-b border-border/30 hover:bg-surface/30 transition-colors">
                <td class="py-3 px-4 text-xs font-bold text-navy">{{ perm.label }}</td>
                <td class="py-3 px-3 text-center">
                  <input type="checkbox" v-model="selectedRole.permissions" :value="perm.key + '.read'" class="w-4 h-4 text-cyan rounded cursor-pointer" />
                </td>
                <td class="py-3 px-3 text-center">
                  <input type="checkbox" v-model="selectedRole.permissions" :value="perm.key + '.create'" class="w-4 h-4 text-cyan rounded cursor-pointer" />
                </td>
                <td class="py-3 px-3 text-center">
                  <input type="checkbox" v-model="selectedRole.permissions" :value="perm.key + '.update'" class="w-4 h-4 text-cyan rounded cursor-pointer" />
                </td>
                <td class="py-3 px-3 text-center">
                  <input type="checkbox" v-model="selectedRole.permissions" :value="perm.key + '.delete'" class="w-4 h-4 text-cyan rounded cursor-pointer" />
                </td>
                <td class="py-3 px-3 text-center">
                  <input type="checkbox" v-model="selectedRole.permissions" :value="perm.key + '.export'" class="w-4 h-4 text-cyan rounded cursor-pointer" />
                </td>
                <td class="py-3 px-3 text-center">
                  <input type="checkbox" v-model="selectedRole.permissions" :value="perm.key + '.admin'" class="w-4 h-4 text-cyan rounded cursor-pointer" />
                </td>
              </tr>
            </template>
          </tbody>
        </table>
      </div>

      <!-- Summary -->
      <div class="p-4 border-t border-border flex items-center justify-between">
        <span class="text-xs text-text-muted">{{ selectedRole.permissions.length }} de {{ totalPermissions }} permisos asignados</span>
        <button @click="savePermissions" class="px-4 py-2 bg-navy text-white text-xs font-bold rounded-xl cursor-pointer">Guardar Cambios</button>
      </div>
    </div>

    <!-- Feature Flags by Plan -->
    <div class="bg-white rounded-2xl border border-border mt-6 overflow-hidden">
      <div class="flex items-center justify-between bg-navy px-5 py-4">
        <h3 class="font-extrabold text-white">Control de Features por Plan</h3>
        <span class="text-[10px] font-bold text-white/60">Define qué módulos están disponibles en cada plan</span>
      </div>
      <div class="p-6">
      <div class="overflow-x-auto">
        <table class="w-full tbl-head">
          <thead>
            <tr class="border-b border-border bg-surface/50">
              <th class="text-left py-3 px-4 text-[10px] font-bold text-text-muted uppercase">Feature / Módulo</th>
              <th class="text-center py-3 px-4 text-[10px] font-bold text-text-muted uppercase">Starter ($49)</th>
              <th class="text-center py-3 px-4 text-[10px] font-bold text-cyan uppercase">Professional ($99)</th>
              <th class="text-center py-3 px-4 text-[10px] font-bold text-gold uppercase">Enterprise ($199)</th>
            </tr>
          </thead>
          <tbody>
            <tr v-for="feature in featureFlags" :key="feature.name" class="border-b border-border/50 hover:bg-surface/30 transition-colors">
              <td class="py-3 px-4">
                <div class="text-sm font-bold text-navy">{{ feature.name }}</div>
                <div class="text-[9px] text-text-muted">{{ feature.description }}</div>
              </td>
              <td class="py-3 px-4 text-center">
                <div class="w-10 h-6 rounded-full relative cursor-pointer mx-auto" :class="feature.starter ? 'bg-teal' : 'bg-gray-200'" @click="feature.starter = !feature.starter">
                  <div class="absolute top-1 w-4 h-4 bg-white rounded-full shadow transition-all" :class="feature.starter ? 'right-1' : 'left-1'"></div>
                </div>
              </td>
              <td class="py-3 px-4 text-center">
                <div class="w-10 h-6 rounded-full relative cursor-pointer mx-auto" :class="feature.professional ? 'bg-teal' : 'bg-gray-200'" @click="feature.professional = !feature.professional">
                  <div class="absolute top-1 w-4 h-4 bg-white rounded-full shadow transition-all" :class="feature.professional ? 'right-1' : 'left-1'"></div>
                </div>
              </td>
              <td class="py-3 px-4 text-center">
                <div class="w-10 h-6 rounded-full relative cursor-pointer mx-auto" :class="feature.enterprise ? 'bg-teal' : 'bg-gray-200'" @click="feature.enterprise = !feature.enterprise">
                  <div class="absolute top-1 w-4 h-4 bg-white rounded-full shadow transition-all" :class="feature.enterprise ? 'right-1' : 'left-1'"></div>
                </div>
              </td>
            </tr>
          </tbody>
        </table>
      </div>
      <button class="mt-4 px-4 py-2 bg-navy text-white text-xs font-bold rounded-xl cursor-pointer">Guardar Features</button>
      </div>
    </div>

    <!-- Create Role Modal -->
    <AppModal v-if="showCreateRole" size="sm" title="Crear Nuevo Rol" @close="showCreateRole = false">
      <div class="space-y-3">
        <div>
          <label class="text-[10px] font-bold text-text-muted uppercase mb-1 block">Nombre</label>
          <input v-model="newRole.name" type="text" placeholder="Ej: Supervisor" class="w-full h-10 px-4 rounded-xl border border-border text-sm focus:outline-none focus:border-cyan" />
        </div>
        <div>
          <label class="text-[10px] font-bold text-text-muted uppercase mb-1 block">Icono</label>
          <div class="flex gap-2 flex-wrap">
            <button v-for="icon in iconOptions" :key="icon" @click="newRole.icon = icon"
              class="w-10 h-10 rounded-xl text-lg flex items-center justify-center border-2 transition-all cursor-pointer"
              :class="newRole.icon === icon ? 'border-cyan bg-cyan/10' : 'border-border hover:border-cyan/50'">{{ icon }}</button>
          </div>
        </div>
        <div>
          <label class="text-[10px] font-bold text-text-muted uppercase mb-1 block">Color</label>
          <div class="flex gap-2">
            <button v-for="c in colorOptions" :key="c.bg" @click="newRole.color = c.class + ' ' + c.bg"
              class="w-8 h-8 rounded-full border-2 transition-all cursor-pointer" :class="[c.bg, newRole.color.includes(c.bg) ? 'border-navy scale-110' : 'border-transparent hover:scale-110']"></button>
          </div>
        </div>
      </div>
      <template #footer>
        <button @click="showCreateRole = false" class="px-4 py-2.5 bg-surface text-navy text-sm font-bold rounded-xl cursor-pointer">Cancelar</button>
        <button @click="createRole" :disabled="!newRole.name" class="px-4 py-2.5 bg-navy text-white text-sm font-bold rounded-xl disabled:opacity-40 cursor-pointer">Crear Rol</button>
      </template>
    </AppModal>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, onMounted } from 'vue'
import { useToast } from '@/composables/useToast'
import { TeamService } from '@/services/Team.service'
const toast = useToast()
import AppModal from '@/components/ui/AppModal.vue'

const selectedRole = ref<any>(null)
const showCreateRole = ref(false)

const newRole = ref({ name: '', icon: '👤', color: 'bg-cyan/20 text-cyan' })

const iconOptions = ['👤', '👑', '🔧', '📊', '💼', '🔒', '🌟', '🎯']
const colorOptions = [
  { bg: 'bg-cyan/20', class: 'text-cyan' },
  { bg: 'bg-teal/20', class: 'text-teal' },
  { bg: 'bg-purple/20', class: 'text-purple' },
  { bg: 'bg-gold/20', class: 'text-gold' },
  { bg: 'bg-coral/20', class: 'text-coral' },
  { bg: 'bg-navy/20', class: 'text-navy' },
]

const roles = ref<any[]>([])

const permissionCategories = [
  { name: 'Dashboard', icon: '📊', permissions: [{ key: 'dashboard', label: 'Dashboard' }] },
  { name: 'Reservas', icon: '📅', permissions: [{ key: 'reservations', label: 'Reservas' }] },
  { name: 'Habitaciones', icon: '🚪', permissions: [{ key: 'rooms', label: 'Habitaciones' }] },
  { name: 'Huéspedes', icon: '👤', permissions: [{ key: 'guests', label: 'CRM de Huéspedes' }] },
  { name: 'Check-in Digital', icon: '📱', permissions: [{ key: 'checkin', label: 'Check-in Digital' }] },
  { name: 'Housekeeping', icon: '🧹', permissions: [{ key: 'housekeeping', label: 'Housekeeping' }] },
  { name: 'Mantenimiento', icon: '🔧', permissions: [{ key: 'maintenance', label: 'Mantenimiento' }] },
  { name: 'Channel Manager', icon: '🔗', permissions: [{ key: 'channels', label: 'Channel Manager' }] },
  { name: 'Booking Engine', icon: '🌐', permissions: [{ key: 'booking', label: 'Booking Engine' }] },
  { name: 'Paquetes', icon: '🎁', permissions: [{ key: 'packages', label: 'Paquetes & Upsells' }] },
  { name: 'Grupos', icon: '👥', permissions: [{ key: 'groups', label: 'Grupos & Blocks' }] },
  { name: 'Night Audit', icon: '🌙', permissions: [{ key: 'nightaudit', label: 'Night Audit' }] },
  { name: 'Facturación', icon: '💰', permissions: [{ key: 'billing', label: 'Facturación' }] },
  { name: 'Reportes', icon: '📈', permissions: [{ key: 'reports', label: 'Reportes' }] },
  { name: 'Planificación', icon: '📋', permissions: [{ key: 'planning', label: 'Planificación Gantt' }] },
  { name: 'Dispositivos', icon: '📡', permissions: [{ key: 'devices', label: 'Dispositivos' }] },
  { name: 'Configuración', icon: '⚙️', permissions: [{ key: 'settings', label: 'Configuración' }] },
  { name: 'Soporte', icon: '🎫', permissions: [{ key: 'support', label: 'Soporte' }] },
]

const featureFlags = ref<any[]>([])

onMounted(async () => {
  try {
    const { data } = await TeamService.listRoles()
    roles.value = data.map((r: any) => ({
      id: r.id,
      name: r.name,
      icon: r.icon ?? '👤',
      color: r.color ?? 'bg-cyan/20 text-cyan',
      system: r.system === 1,
      users: r.usuarios ?? 0,
      permissions: (() => { try { return JSON.parse(r.permissions || '[]') } catch { return [] } })(),
    }))
  } catch { toast.error('No se pudieron cargar los roles') }
  try {
    const { ConfigService } = await import('@/services/Platform.service')
    const flags = await ConfigService.get('feature_flags', 'platform')
    if (Array.isArray(flags)) featureFlags.value = flags
  } catch { /* silent */ }
})

const totalPermissions = computed(() => permissionCategories.reduce((sum, cat) => sum + cat.permissions.length * 6, 0))

// Initialize selected role
if (roles.value.length > 0) selectedRole.value = roles.value[1]

function selectAll() {
  if (!selectedRole.value) return
  const allPerms: string[] = []
  permissionCategories.forEach(cat => {
    cat.permissions.forEach(p => {
      allPerms.push(p.key + '.read', p.key + '.create', p.key + '.update', p.key + '.delete', p.key + '.export', p.key + '.admin')
    })
  })
  selectedRole.value.permissions = allPerms
}

function deselectAll() {
  if (!selectedRole.value) return
  selectedRole.value.permissions = []
}

// BUG FIX: savePermissions era `/* TODO: persist */` → el botón "Guardar Cambios" no persistía nada;
// el admin creía que guardaba y al recargar volvía todo. Ahora llama a RolesService.update con los
// permisos del rol seleccionado y refleja el resultado en la lista local.
async function savePermissions() {
  const role = selectedRole.value
  if (!role) return
  try {
    const { RolesService } = await import('@/services/Roles.service')
    const updated = await RolesService.update(String(role.id), { permissions: [...role.permissions] })
    role.permissions = updated.permissions
    const idx = roles.value.findIndex((r: any) => r.id === role.id)
    if (idx >= 0) roles.value[idx].permissions = updated.permissions
    toast.success('Permisos guardados')
  } catch (e) {
    console.error('savePermissions: no se pudieron guardar los permisos', e)
    toast.error('No se pudieron guardar los permisos')
  }
}

function createRole() {
  roles.value.push({
    id: roles.value.length + 1,
    name: newRole.value.name,
    icon: newRole.value.icon,
    color: newRole.value.color,
    system: false,
    users: 0,
    permissions: [],
  })
  showCreateRole.value = false
  newRole.value = { name: '', icon: '👤', color: 'bg-cyan/20 text-cyan' }
}
</script>
