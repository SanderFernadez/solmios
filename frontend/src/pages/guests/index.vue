<template>
  <div>
    <!-- Header -->
    <div class="flex items-center justify-between mb-6">
      <div>
        <h2 class="text-xl font-black text-navy">Huéspedes</h2>
        <p class="text-sm text-text-muted mt-0.5">CRM y fidelización de clientes</p>
      </div>
      <button @click="openNewGuest" class="bg-cyan text-navy font-extrabold text-sm px-5 py-2.5 rounded-xl hover:shadow-lg transition-all cursor-pointer">
        + Nuevo Huésped
      </button>
    </div>

    <!-- Stats -->
    <div class="grid grid-cols-4 gap-4 mb-6">
      <div class="card p-4 text-center">
        <div class="text-2xl font-black text-navy">{{ guests.length }}</div>
        <div class="text-[10px] text-text-muted font-bold uppercase">Total Huéspedes</div>
      </div>
      <div class="card p-4 text-center">
        <div class="text-2xl font-black text-cyan">{{ activeToday }}</div>
        <div class="text-[10px] text-text-muted font-bold uppercase">Activos Hoy</div>
      </div>
      <div class="card p-4 text-center">
        <div class="text-2xl font-black text-teal">{{ frequentGuests }}</div>
        <div class="text-[10px] text-text-muted font-bold uppercase">Frecuentes</div>
      </div>
      <div class="card p-4 text-center">
        <div class="text-2xl font-black text-gold">{{ totalPoints.toLocaleString() }}</div>
        <div class="text-[10px] text-text-muted font-bold uppercase">Puntos OTorgados</div>
      </div>
    </div>

    <!-- Guest List -->
    <div class="card overflow-hidden">
      <div class="p-4 border-b border-border">
        <div class="flex items-center gap-3">
          <input v-model="searchQuery" type="text" placeholder="Buscar por nombre, email o teléfono..." class="flex-1 px-4 py-2.5 rounded-xl border border-border text-sm focus:outline-none focus:border-navy" />
          <select v-model="filterType" class="px-4 py-2.5 rounded-xl border border-border text-sm focus:outline-none focus:border-navy cursor-pointer">
            <option value="all">Todos</option>
            <option value="frequent">Frecuentes (5+ estadías)</option>
            <option value="new">Nuevos (1 estadía)</option>
            <option value="vip">VIP ($5,000+ gastados)</option>
          </select>
        </div>
      </div>
      <table class="w-full">
        <thead>
          <tr class="border-b border-border bg-surface/50">
            <th class="text-left p-4 text-[10px] font-bold text-text-muted uppercase">Huésped</th>
            <th class="text-left p-4 text-[10px] font-bold text-text-muted uppercase">Contacto</th>
            <th class="text-left p-4 text-[10px] font-bold text-text-muted uppercase">Estadías</th>
            <th class="text-left p-4 text-[10px] font-bold text-text-muted uppercase">Total Gastado</th>
            <th class="text-left p-4 text-[10px] font-bold text-text-muted uppercase">Puntos</th>
            <th class="text-left p-4 text-[10px] font-bold text-text-muted uppercase">Última Visita</th>
            <th class="text-right p-4 text-[10px] font-bold text-text-muted uppercase">Acciones</th>
          </tr>
        </thead>
        <tbody>
          <tr
            v-for="guest in filteredGuests"
            :key="guest.id"
            @click="openViewGuest(guest)"
            class="border-b border-border last:border-0 hover:bg-surface/50 transition-colors cursor-pointer"
          >
            <td class="p-4">
              <div class="flex items-center gap-3">
                <div class="w-10 h-10 rounded-full flex items-center justify-center text-sm font-bold" :class="guestAvatarClass(guest)">
                  {{ guest.initials }}
                </div>
                <div>
                  <div class="text-sm font-bold text-navy">{{ guest.name }}</div>
                  <div class="text-[10px] text-text-muted">{{ guest.nationality }}</div>
                </div>
              </div>
            </td>
            <td class="p-4">
              <div class="text-sm">{{ guest.email }}</div>
              <div class="text-[10px] text-text-muted">{{ guest.phone }}</div>
            </td>
            <td class="p-4 text-sm font-bold">{{ guest.stays }}</td>
            <td class="p-4 text-sm font-extrabold text-navy">${{ guest.totalSpent.toLocaleString() }}</td>
            <td class="p-4">
              <span class="badge badge-info">{{ guest.points.toLocaleString() }}</span>
            </td>
            <td class="p-4 text-sm text-text-secondary">{{ guest.lastVisit }}</td>
            <td class="p-4 text-right">
              <div class="flex gap-1 justify-end">
                <button @click.stop="openViewGuest(guest)" class="px-2 py-1 bg-cyan/10 text-cyan rounded-lg text-[10px] font-bold hover:bg-cyan/20 transition-colors cursor-pointer">Ver</button>
                <button @click.stop="openEditGuest(guest)" class="px-2 py-1 bg-navy/10 text-navy rounded-lg text-[10px] font-bold hover:bg-navy/20 transition-colors cursor-pointer">Editar</button>
              </div>
            </td>
          </tr>
        </tbody>
      </table>
    </div>

    <!-- View Guest Profile Modal -->
    <Teleport to="body">
      <div v-if="showViewModal && viewGuest" class="fixed inset-0 z-50 flex items-center justify-center p-4" @click.self="closeViewModal">
        <div class="absolute inset-0 bg-navy/40 backdrop-blur-sm" @click="closeViewModal"></div>

        <div class="relative bg-white rounded-2xl shadow-2xl w-full max-w-2xl max-h-[90vh] overflow-y-auto">
          <!-- Header -->
          <div class="p-6 border-b border-border bg-gradient-to-r from-navy to-navy-light">
            <div class="flex items-center justify-between">
              <div class="flex items-center gap-4">
                <div class="w-16 h-16 rounded-full flex items-center justify-center text-xl font-black" :class="viewGuestAvatarClass">
                  {{ viewGuest.initials }}
                </div>
                <div>
                  <h3 class="text-xl font-black text-white">{{ viewGuest.name }}</h3>
                  <p class="text-sm text-gray-300">{{ viewGuest.nationality }} · {{ viewGuest.email }}</p>
                </div>
              </div>
              <button @click="closeViewModal" class="w-8 h-8 rounded-lg bg-white/20 flex items-center justify-center text-white hover:bg-white/30 transition-colors cursor-pointer">✕</button>
            </div>
          </div>

          <!-- Body -->
          <div class="p-6 space-y-6">
            <!-- Stats Row -->
            <div class="grid grid-cols-4 gap-4">
              <div class="bg-surface rounded-xl p-4 text-center">
                <div class="text-2xl font-black text-navy">{{ viewGuest.stays }}</div>
                <div class="text-[10px] text-text-muted uppercase">Estadías</div>
              </div>
              <div class="bg-surface rounded-xl p-4 text-center">
                <div class="text-2xl font-black text-cyan">${{ viewGuest.totalSpent.toLocaleString() }}</div>
                <div class="text-[10px] text-text-muted uppercase">Total Gastado</div>
              </div>
              <div class="bg-surface rounded-xl p-4 text-center">
                <div class="text-2xl font-black text-gold">{{ viewGuest.points.toLocaleString() }}</div>
                <div class="text-[10px] text-text-muted uppercase">Puntos</div>
              </div>
              <div class="bg-surface rounded-xl p-4 text-center">
                <div class="text-2xl font-black" :class="viewGuestTier.color">{{ viewGuestTier.label }}</div>
                <div class="text-[10px] text-text-muted uppercase">Tier</div>
              </div>
            </div>

            <!-- Contact Info -->
            <div>
              <h4 class="text-sm font-bold text-navy mb-3">Información de Contacto</h4>
              <div class="grid grid-cols-2 gap-4">
                <div class="bg-surface rounded-xl p-4">
                  <div class="text-[10px] text-text-muted uppercase mb-1">Email</div>
                  <div class="text-sm font-bold text-navy">{{ viewGuest.email }}</div>
                </div>
                <div class="bg-surface rounded-xl p-4">
                  <div class="text-[10px] text-text-muted uppercase mb-1">Teléfono</div>
                  <div class="text-sm font-bold text-navy">{{ viewGuest.phone }}</div>
                </div>
                <div class="bg-surface rounded-xl p-4">
                  <div class="text-[10px] text-text-muted uppercase mb-1">Documento</div>
                  <div class="text-sm font-bold text-navy">{{ viewGuest.document }}</div>
                </div>
                <div class="bg-surface rounded-xl p-4">
                  <div class="text-[10px] text-text-muted uppercase mb-1">Fecha de Nacimiento</div>
                  <div class="text-sm font-bold text-navy">{{ viewGuest.birthDate }}</div>
                </div>
              </div>
            </div>

            <!-- Preferences -->
            <div>
              <h4 class="text-sm font-bold text-navy mb-3">Preferencias</h4>
              <div class="flex flex-wrap gap-2">
                <span v-for="pref in viewGuest.preferences" :key="pref" class="px-3 py-1.5 bg-navy/5 rounded-lg text-[11px] font-bold text-navy">
                  {{ pref }}
                </span>
              </div>
            </div>

            <!-- Stay History -->
            <div>
              <h4 class="text-sm font-bold text-navy mb-3">Historial de Estadías</h4>
              <div class="space-y-3">
                <div v-for="stay in viewGuest.history" :key="stay.id" class="bg-surface rounded-xl p-4 flex items-center justify-between">
                  <div class="flex items-center gap-3">
                    <div class="w-10 h-10 rounded-lg bg-navy/10 flex items-center justify-center text-sm font-bold text-navy">
                      {{ stay.room }}
                    </div>
                    <div>
                      <div class="text-sm font-bold text-navy">{{ stay.dates }}</div>
                      <div class="text-[10px] text-text-muted">{{ stay.nights }} noches · ${{ stay.total }}</div>
                    </div>
                  </div>
                  <span class="text-[10px] font-bold px-2 py-1 rounded-full" :class="stay.status === 'completed' ? 'bg-teal/10 text-teal' : 'bg-gold/10 text-gold'">
                    {{ stay.status === 'completed' ? 'Completada' : 'Cancelada' }}
                  </span>
                </div>
              </div>
            </div>

            <!-- Notes -->
            <div v-if="viewGuest.notes">
              <h4 class="text-sm font-bold text-navy mb-3">Notas</h4>
              <div class="bg-surface rounded-xl p-4 text-sm text-text-secondary">
                {{ viewGuest.notes }}
              </div>
            </div>
          </div>

          <!-- Actions -->
          <div class="p-6 border-t border-border bg-surface/50">
            <div class="flex gap-3">
              <button @click="closeViewModal(); openEditGuest(viewGuest)" class="px-5 py-2.5 bg-navy text-white rounded-xl text-sm font-bold hover:bg-navy-light transition-colors cursor-pointer">
                Editar Perfil
              </button>
              <button @click="closeViewModal" class="px-5 py-2.5 border border-border rounded-xl text-sm font-bold text-text-secondary hover:border-navy/30 transition-colors cursor-pointer">
                Cerrar
              </button>
            </div>
          </div>
        </div>
      </div>
    </Teleport>

    <!-- New/Edit Guest Modal -->
    <Teleport to="body">
      <div v-if="showFormModal" class="fixed inset-0 z-50 flex items-center justify-center p-4" @click.self="closeFormModal">
        <div class="absolute inset-0 bg-navy/40 backdrop-blur-sm" @click="closeFormModal"></div>

        <div class="relative bg-white rounded-2xl shadow-2xl w-full max-w-lg max-h-[90vh] overflow-y-auto">
          <div class="p-5 border-b border-border">
            <div class="flex items-center justify-between">
              <h3 class="text-lg font-black text-navy">{{ editingGuest ? 'Editar Huésped' : 'Nuevo Huésped' }}</h3>
              <button @click="closeFormModal" class="w-8 h-8 rounded-lg bg-surface flex items-center justify-center text-text-secondary hover:text-navy transition-colors cursor-pointer">✕</button>
            </div>
          </div>

          <div class="p-5 space-y-4">
            <div class="grid grid-cols-2 gap-4">
              <div>
                <label class="block text-[11px] font-bold text-navy uppercase tracking-wide mb-2">Nombre Completo</label>
                <input v-model="form.name" type="text" placeholder="Nombre y apellido" class="w-full px-4 py-2.5 rounded-xl border border-border text-sm focus:outline-none focus:border-navy" />
              </div>
              <div>
                <label class="block text-[11px] font-bold text-navy uppercase tracking-wide mb-2">Nacionalidad</label>
                <input v-model="form.nationality" type="text" placeholder="🇩🇴 RD" class="w-full px-4 py-2.5 rounded-xl border border-border text-sm focus:outline-none focus:border-navy" />
              </div>
            </div>

            <div class="grid grid-cols-2 gap-4">
              <div>
                <label class="block text-[11px] font-bold text-navy uppercase tracking-wide mb-2">Email</label>
                <input v-model="form.email" type="email" placeholder="email@ejemplo.com" class="w-full px-4 py-2.5 rounded-xl border border-border text-sm focus:outline-none focus:border-navy" />
              </div>
              <div>
                <label class="block text-[11px] font-bold text-navy uppercase tracking-wide mb-2">Teléfono</label>
                <input v-model="form.phone" type="tel" placeholder="+1 809-555-0101" class="w-full px-4 py-2.5 rounded-xl border border-border text-sm focus:outline-none focus:border-navy" />
              </div>
            </div>

            <div class="grid grid-cols-2 gap-4">
              <div>
                <label class="block text-[11px] font-bold text-navy uppercase tracking-wide mb-2">Documento</label>
                <input v-model="form.document" type="text" placeholder="Pasaporte o ID" class="w-full px-4 py-2.5 rounded-xl border border-border text-sm focus:outline-none focus:border-navy" />
              </div>
              <div>
                <label class="block text-[11px] font-bold text-navy uppercase tracking-wide mb-2">Fecha de Nacimiento</label>
                <input v-model="form.birthDate" type="date" class="w-full px-4 py-2.5 rounded-xl border border-border text-sm focus:outline-none focus:border-navy" />
              </div>
            </div>

            <div>
              <label class="block text-[11px] font-bold text-navy uppercase tracking-wide mb-2">Preferencias</label>
              <div class="flex flex-wrap gap-2">
                <button
                  v-for="pref in allPreferences"
                  :key="pref"
                  @click="togglePreference(pref)"
                  class="px-3 py-1.5 rounded-lg text-[11px] font-bold border-2 transition-all cursor-pointer"
                  :class="form.preferences.includes(pref) ? 'border-navy bg-navy/5 text-navy' : 'border-border text-text-secondary hover:border-navy/30'"
                >
                  {{ pref }}
                </button>
              </div>
            </div>

            <div>
              <label class="block text-[11px] font-bold text-navy uppercase tracking-wide mb-2">Notas</label>
              <textarea v-model="form.notes" rows="3" placeholder="Alergias, solicitudes especiales, etc." class="w-full px-4 py-2.5 rounded-xl border border-border text-sm focus:outline-none focus:border-navy resize-none"></textarea>
            </div>
          </div>

          <div class="p-5 border-t border-border bg-surface/50">
            <div class="flex gap-3 justify-end">
              <button @click="closeFormModal" class="px-5 py-2.5 border border-border rounded-xl text-sm font-bold text-text-secondary hover:border-navy/30 transition-colors cursor-pointer">Cancelar</button>
              <button @click="saveGuest" class="px-5 py-2.5 bg-navy text-white rounded-xl text-sm font-bold hover:bg-navy-light transition-colors cursor-pointer">
                {{ editingGuest ? 'Guardar Cambios' : 'Crear Huésped' }}
              </button>
            </div>
          </div>
        </div>
      </div>
    </Teleport>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, onMounted } from 'vue'
import { GuestService } from '@/services/Guest.service'
import { useAuthStore } from '@/stores/auth.store'
import { useToast } from '@/composables/useToast'

const auth = useAuthStore()
const toast = useToast()
const hotelId = computed(() => (auth.user?.hotelId && auth.user.hotelId !== 'platform' ? auth.user.hotelId : undefined))

const searchQuery = ref('')
const filterType = ref('all')
const showViewModal = ref(false)
const showFormModal = ref(false)
const viewGuest = ref<any>(null)
const editingGuest = ref<any>(null)

const form = ref({
  name: '',
  email: '',
  phone: '',
  nationality: '',
  document: '',
  birthDate: '',
  preferences: [] as string[],
  notes: '',
})

const allPreferences = ['Habitación silenciosa', 'Piso alto', 'Vista al mar', 'Cama king', 'Almohadas extras', 'Sin gluten', 'Vegetariano', 'Business center', 'Gimnasio', 'Piscina']

function initialsOf(name?: string): string {
  if (!name) return '?'
  return name.trim().split(/\s+/).slice(0, 2).map(p => p[0]?.toUpperCase() ?? '').join('')
}

const guests = ref<any[]>([])

onMounted(async () => {
  try {
    const { guests: data } = await GuestService.list({ hotelId: hotelId.value })
    guests.value = data.map(g => ({
      id: g.id,
      name: g.name ?? `${g.firstName} ${g.lastName}`.trim(),
      initials: initialsOf(g.name ?? g.firstName),
      email: g.email ?? '',
      phone: g.phone ?? '',
      nationality: g.nationality ?? '',
      document: g.documentNumber ?? '',
      birthDate: '',
      stays: g.totalStays,
      totalSpent: g.totalSpent,
      points: g.loyaltyPoints,
      lastVisit: '',
      preferences: [],
      notes: '',
      history: [],
    }))
  } catch { toast.error("Error al cargar datos") }
})

const activeToday = computed(() => guests.value.filter((g: any) => g.history?.some((h: any) => h.status === 'current')).length)
const frequentGuests = computed(() => guests.value.filter((g: any) => g.stays >= 5).length)
const totalPoints = computed(() => guests.value.reduce((sum: number, g: any) => sum + (g.points ?? 0), 0))

const filteredGuests = computed(() => {
  let result = guests.value

  if (searchQuery.value) {
    const q = searchQuery.value.toLowerCase()
    result = result.filter(g =>
      g.name.toLowerCase().includes(q) ||
      g.email.toLowerCase().includes(q) ||
      g.phone.includes(q)
    )
  }

  if (filterType.value === 'frequent') result = result.filter(g => g.stays >= 5)
  else if (filterType.value === 'new') result = result.filter(g => g.stays <= 1)
  else if (filterType.value === 'vip') result = result.filter(g => g.totalSpent >= 5000)

  return result
})

function guestAvatarClass(guest: any) {
  if (guest.totalSpent >= 5000) return 'bg-gold/10 text-gold'
  if (guest.stays >= 5) return 'bg-teal/10 text-teal'
  return 'bg-navy/10 text-navy'
}

const viewGuestAvatarClass = computed(() => {
  if (!viewGuest.value) return ''
  if (viewGuest.value.totalSpent >= 5000) return 'bg-gold/20 text-gold'
  if (viewGuest.value.stays >= 5) return 'bg-teal/20 text-teal'
  return 'bg-navy/20 text-navy'
})

const viewGuestTier = computed(() => {
  if (!viewGuest.value) return { label: '', color: '' }
  if (viewGuest.value.totalSpent >= 5000) return { label: 'VIP', color: 'text-gold' }
  if (viewGuest.value.stays >= 5) return { label: 'Frecuente', color: 'text-teal' }
  return { label: 'Regular', color: 'text-navy' }
})

function openViewGuest(guest: any) {
  viewGuest.value = { ...guest }
  showViewModal.value = true
}

function closeViewModal() {
  showViewModal.value = false
  viewGuest.value = null
}

function openNewGuest() {
  editingGuest.value = null
  form.value = { name: '', email: '', phone: '', nationality: '', document: '', birthDate: '', preferences: [], notes: '' }
  showFormModal.value = true
}

function openEditGuest(guest: any) {
  editingGuest.value = { id: guest.id }
  form.value = { name: guest.name, email: guest.email, phone: guest.phone, nationality: guest.nationality, document: guest.document, birthDate: '', preferences: [...guest.preferences], notes: guest.notes ?? '' }
  showFormModal.value = true
}

function closeFormModal() {
  showFormModal.value = false
  editingGuest.value = null
}

function togglePreference(pref: string) {
  const idx = form.value.preferences.indexOf(pref)
  if (idx >= 0) form.value.preferences.splice(idx, 1)
  else form.value.preferences.push(pref)
}

async function saveGuest() {
  if (!form.value.name || !form.value.email) { toast.warning('Nombre y email requeridos'); return }

  try {
    if (editingGuest.value) {
      await GuestService.update(editingGuest.value.id, {
        name: form.value.name,
        email: form.value.email,
        phone: form.value.phone,
        nationality: form.value.nationality,
        document: form.value.document,
        hotelId: hotelId.value,
      })
      toast.success('Huésped actualizado')
    } else {
      await GuestService.create({
        name: form.value.name,
        email: form.value.email,
        phone: form.value.phone,
        nationality: form.value.nationality,
        document: form.value.document,
        hotelId: hotelId.value,
      })
      toast.success('Huésped creado')
    }
    const { guests: data } = await GuestService.list({ hotelId: hotelId.value })
    guests.value = data.map(g => ({
      id: g.id,
      name: g.name ?? `${g.firstName} ${g.lastName}`.trim(),
      initials: initialsOf(g.name ?? g.firstName),
      email: g.email ?? '',
      phone: g.phone ?? '',
      nationality: g.nationality ?? '',
      document: g.documentNumber ?? '',
      birthDate: '',
      stays: g.totalStays,
      totalSpent: g.totalSpent,
      points: g.loyaltyPoints,
      lastVisit: '',
      preferences: [],
      notes: '',
      history: [],
    }))
    closeFormModal()
  } catch {
    toast.error('Error al guardar huésped')
  }
}
</script>
