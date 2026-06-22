<template>
  <div>
    <div class="flex items-center justify-between mb-4 flex-wrap gap-3">
      <div>
        <h2 class="text-xl font-black text-navy">Equipo</h2>
        <p class="text-xs text-text-muted mt-0.5">Gestiona los usuarios y roles de tu hotel</p>
      </div>
      <div class="flex gap-2">
        <button @click="load" :disabled="loading" class="px-4 py-2 bg-navy/5 hover:bg-navy/10 text-navy rounded-xl text-sm font-bold cursor-pointer disabled:opacity-50">
          {{ loading ? 'Cargando...' : '↻ Refrescar' }}
        </button>
        <button @click="openInvite" class="bg-cyan text-navy font-extrabold text-sm px-5 py-2.5 rounded-xl hover:shadow-lg cursor-pointer">+ Invitar miembro</button>
      </div>
    </div>

    <!-- Stats -->
    <div class="grid grid-cols-3 gap-3 mb-6">
      <div class="card p-4 text-center">
        <div class="text-2xl font-black text-navy">{{ members.length }}</div>
        <div class="text-[10px] text-text-muted uppercase font-bold">Miembros</div>
      </div>
      <div class="card p-4 text-center">
        <div class="text-2xl font-black text-cyan">{{ adminCount }}</div>
        <div class="text-[10px] text-text-muted uppercase font-bold">Admins</div>
      </div>
      <div class="card p-4 text-center">
        <div class="text-2xl font-black text-teal">{{ receptionistCount }}</div>
        <div class="text-[10px] text-text-muted uppercase font-bold">Recepcionistas</div>
      </div>
    </div>

    <!-- Aviso de seguridad -->
    <div class="bg-blue-50 border border-blue-200 rounded-xl p-3 mb-4 flex items-start gap-2">
      <span class="text-base shrink-0">🔒</span>
      <p class="text-xs text-blue-800">
        Los miembros solo ven datos de <strong>tu hotel</strong>. Solo tú (admin) puedes gestionar roles.
        No puedes degradarte a ti mismo.
      </p>
    </div>

    <!-- Lista -->
    <div v-if="loading && members.length === 0" class="card p-12 text-center text-sm text-text-muted">Cargando equipo...</div>
    <div v-else-if="members.length === 0" class="card p-12 text-center">
      <div class="text-4xl mb-3 opacity-50">👥</div>
      <h3 class="font-bold text-navy mb-1">Sin miembros</h3>
      <p class="text-xs text-text-muted mb-4">Invita al primer miembro de tu equipo</p>
      <button @click="openInvite" class="px-5 py-2.5 bg-cyan text-navy rounded-xl text-sm font-bold cursor-pointer">+ Invitar</button>
    </div>
    <div v-else class="bg-white rounded-2xl border border-border overflow-hidden">
      <table class="w-full">
        <thead>
          <tr class="border-b border-border bg-surface/50">
            <th class="text-left p-4 text-[10px] font-bold text-text-muted uppercase">Miembro</th>
            <th class="text-left p-4 text-[10px] font-bold text-text-muted uppercase">Email</th>
            <th class="text-left p-4 text-[10px] font-bold text-text-muted uppercase">Rol</th>
            <th class="text-left p-4 text-[10px] font-bold text-text-muted uppercase">Estado</th>
            <th class="text-left p-4 text-[10px] font-bold text-text-muted uppercase">Creado</th>
            <th class="text-right p-4 text-[10px] font-bold text-text-muted uppercase">Acciones</th>
          </tr>
        </thead>
        <tbody>
          <tr v-for="m in members" :key="m.id" class="border-b border-border/50 last:border-0 hover:bg-surface/30">
            <td class="p-4">
              <div class="flex items-center gap-3">
                <div class="w-9 h-9 rounded-full flex items-center justify-center text-sm font-black shrink-0"
                  :class="roleMeta(m.role).class">
                  {{ m.name?.charAt(0).toUpperCase() || '?' }}
                </div>
                <div>
                  <div class="text-sm font-bold text-navy">{{ m.name }}</div>
                  <div v-if="m.id === currentUser" class="text-[10px] text-cyan font-bold">Tú</div>
                </div>
              </div>
            </td>
            <td class="p-4 text-xs text-text-secondary">{{ m.email }}</td>
            <td class="p-4">
              <span class="text-[10px] font-bold px-2 py-1 rounded-full" :class="roleMeta(m.role).class">
                {{ roleMeta(m.role).icon }} {{ roleMeta(m.role).label }}
              </span>
            </td>
            <td class="p-4">
              <span class="text-[10px] font-bold px-2 py-1 rounded-full"
                :class="(m.active === 1 || m.active === true || m.active === undefined) ? 'bg-teal/10 text-teal' : 'bg-gray-100 text-gray-500'">
                {{ (m.active === 1 || m.active === true || m.active === undefined) ? 'Activo' : 'Inactivo' }}
              </span>
            </td>
            <td class="p-4 text-xs text-text-muted">{{ formatDate(m.createdAt) }}</td>
            <td class="p-4 text-right" @click.stop>
              <button
                v-if="m.id !== currentUser"
                @click="openChangeRole(m)"
                class="px-3 py-1 bg-navy/10 text-navy rounded-lg text-[10px] font-bold cursor-pointer hover:bg-navy/20">
                Cambiar rol
              </button>
              <span v-else class="text-[10px] text-text-muted italic">—</span>
            </td>
          </tr>
        </tbody>
      </table>
    </div>

    <!-- Modal cambiar rol -->
    <Teleport to="body">
      <div v-if="roleModal.show" class="fixed inset-0 z-50 flex items-center justify-center p-4" @click.self="roleModal.show=false">
        <div class="absolute inset-0 bg-navy/40 backdrop-blur-sm"></div>
        <div class="relative bg-white rounded-2xl shadow-2xl w-full max-w-md p-6">
          <h3 class="text-lg font-black text-navy mb-2">Cambiar rol</h3>
          <p class="text-xs text-text-muted mb-4">
            <strong class="text-navy">{{ roleModal.member?.name }}</strong> · {{ roleModal.member?.email }}
          </p>
          <div class="space-y-2">
            <button
              v-for="role in availableRoles"
              :key="role.key"
              @click="selectedRole = role.key"
              class="w-full text-left p-3 rounded-xl border-2 transition-all cursor-pointer flex items-center gap-3"
              :class="selectedRole === role.key ? 'border-navy bg-navy/5' : 'border-border hover:border-navy/30'"
            >
              <span class="text-xl">{{ role.icon }}</span>
              <div class="flex-1">
                <div class="text-sm font-bold text-navy">{{ role.label }}</div>
                <div class="text-[10px] text-text-muted">{{ role.description }}</div>
              </div>
              <span v-if="selectedRole === role.key" class="text-navy font-bold">✓</span>
            </button>
          </div>
          <div class="flex gap-3 mt-5">
            <button @click="roleModal.show=false" class="flex-1 py-2.5 border border-border rounded-xl text-sm font-bold text-text-secondary cursor-pointer">Cancelar</button>
            <button @click="changeRole" :disabled="changing" class="flex-1 py-2.5 bg-navy text-white rounded-xl text-sm font-bold cursor-pointer disabled:opacity-50">
              {{ changing ? 'Guardando...' : 'Confirmar' }}
            </button>
          </div>
        </div>
      </div>
    </Teleport>

    <!-- Modal invitar (mock - placeholder) -->
    <Teleport to="body">
      <div v-if="inviteModal" class="fixed inset-0 z-50 flex items-center justify-center p-4" @click.self="inviteModal=false">
        <div class="absolute inset-0 bg-navy/40 backdrop-blur-sm"></div>
        <div class="relative bg-white rounded-2xl shadow-2xl w-full max-w-md p-6">
          <h3 class="text-lg font-black text-navy mb-2">Invitar miembro</h3>
          <p class="text-xs text-text-muted mb-4">Crea un nuevo usuario para tu hotel</p>
          <div class="space-y-3">
            <div>
              <label class="text-[10px] font-bold text-text-muted uppercase mb-1 block">Nombre</label>
              <input v-model="inviteForm.name" type="text" class="w-full px-3 py-2 rounded-lg border border-border text-sm" />
            </div>
            <div>
              <label class="text-[10px] font-bold text-text-muted uppercase mb-1 block">Email</label>
              <input v-model="inviteForm.email" type="email" class="w-full px-3 py-2 rounded-lg border border-border text-sm" />
            </div>
            <div>
              <label class="text-[10px] font-bold text-text-muted uppercase mb-1 block">Rol inicial</label>
              <select v-model="inviteForm.role" class="w-full px-3 py-2 rounded-lg border border-border text-sm cursor-pointer">
                <option value="receptionist">🛎️ Recepcionista</option>
                <option value="hotel_admin">🏨 Admin Hotel</option>
              </select>
            </div>
            <div>
              <label class="text-[10px] font-bold text-text-muted uppercase mb-1 block">Contraseña temporal</label>
              <input v-model="inviteForm.password" type="text" placeholder="auto-generada si vacío" class="w-full px-3 py-2 rounded-lg border border-border text-sm font-mono" />
            </div>
          </div>
          <div class="flex gap-3 mt-5">
            <button @click="inviteModal=false" class="flex-1 py-2.5 border border-border rounded-xl text-sm font-bold text-text-secondary cursor-pointer">Cancelar</button>
            <button @click="sendInvite" :disabled="inviting" class="flex-1 py-2.5 bg-cyan text-navy rounded-xl text-sm font-bold cursor-pointer disabled:opacity-50">
              {{ inviting ? 'Creando...' : 'Crear y enviar' }}
            </button>
          </div>
        </div>
      </div>
    </Teleport>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, onMounted } from 'vue'
import { TeamService, roleMeta } from '@/services/Team.service'
import type { TeamMember } from '@/services/Team.service'
import { useAuthStore } from '@/stores/auth.store'
import { useToast } from '@/composables/useToast'

const auth = useAuthStore()
const toast = useToast()

const currentUser = computed(() => auth.user?.id || '')
const members = ref<TeamMember[]>([])
const loading = ref(false)

const adminCount = computed(() => members.value.filter(m => m.role === 'hotel_admin').length)
const receptionistCount = computed(() => members.value.filter(m => m.role === 'receptionist').length)

const availableRoles = [
  { key: 'hotel_admin', label: 'Admin Hotel', icon: '🏨', description: 'Acceso completo al hotel (no puede eliminarse a sí mismo)' },
  { key: 'receptionist', label: 'Recepcionista', icon: '🛎️', description: 'Reservas, check-in/out, huéspedes. Sin acceso a finanzas ni equipo' },
]

async function load() {
  loading.value = true
  try {
    const r = await TeamService.list()
    members.value = (r.data || []).map((u: any) => ({
      id: u.id,
      name: u.name,
      email: u.email,
      role: u.role,
      hotelId: u.hotelId,
      active: u.active,
      createdAt: u.createdAt,
    }))
  } catch (e: any) {
    toast.error(e.message || 'Error al cargar equipo')
    members.value = []
  } finally {
    loading.value = false
  }
}

// Modal cambio de rol
const roleModal = ref<{ show: boolean; member: TeamMember | null }>({ show: false, member: null })
const selectedRole = ref('')
const changing = ref(false)

function openChangeRole(m: TeamMember) {
  if (m.id === currentUser.value) {
    toast.info('No puedes cambiar tu propio rol')
    return
  }
  roleModal.value = { show: true, member: m }
  selectedRole.value = m.role
}

async function changeRole() {
  if (!roleModal.value.member) return
  if (selectedRole.value === roleModal.value.member.role) {
    roleModal.value.show = false
    return
  }
  changing.value = true
  try {
    await TeamService.changeRole(roleModal.value.member.id, selectedRole.value)
    roleModal.value.member.role = selectedRole.value
    toast.success(`Rol cambiado a ${roleMeta(selectedRole.value).label}`)
    roleModal.value.show = false
  } catch (e: any) {
    toast.error(e.message || 'Error al cambiar rol')
  } finally {
    changing.value = false
  }
}

// Modal invitar
const inviteModal = ref(false)
const inviteForm = ref<{ name: string; email: string; role: string; password: string }>({
  name: '', email: '', role: 'receptionist', password: '',
})
const inviting = ref(false)

function openInvite() {
  inviteForm.value = { name: '', email: '', role: 'receptionist', password: Math.random().toString(36).slice(2, 10) }
  inviteModal.value = true
}

async function sendInvite() {
  if (!inviteForm.value.name || !inviteForm.value.email) {
    toast.error('Nombre y email son obligatorios')
    return
  }
  inviting.value = true
  try {
    const hotelId = auth.user?.hotelId
    if (!hotelId || hotelId === 'platform') {
      toast.error('Sin hotel asignado')
      return
    }
    await TeamService.create({
      name: inviteForm.value.name,
      email: inviteForm.value.email,
      role: inviteForm.value.role,
      hotelId,
      password: inviteForm.value.password || undefined,
    })
    toast.success('Miembro creado')
    inviteModal.value = false
    await load()
  } catch (e: any) {
    toast.error(e.message || 'Error al crear miembro')
  } finally {
    inviting.value = false
  }
}

function formatDate(d?: string): string {
  if (!d) return '—'
  return new Date(d.includes('T') ? d : d + 'T12:00:00').toLocaleDateString('es-ES', { day: '2-digit', month: 'short', year: 'numeric' })
}

onMounted(load)
</script>
