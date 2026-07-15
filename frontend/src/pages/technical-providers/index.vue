<template>
  <div>
    <!-- Header -->
    <div class="flex items-center gap-2.5 mb-1.5">
      <h2 class="text-xl font-black text-navy">Proveedores técnicos</h2>
      <span class="inline-flex items-center gap-1.5 rounded-full bg-[#DCFCE7] px-2.5 py-1 text-[10px] font-extrabold uppercase text-[#16A34A]">
        <span class="relative flex h-1.5 w-1.5">
          <span class="absolute inline-flex h-full w-full animate-ping rounded-full bg-[#22C55E] opacity-60"></span>
          <span class="relative inline-flex h-1.5 w-1.5 rounded-full bg-[#22C55E]"></span>
        </span>
        En vivo
      </span>
    </div>

    <div class="flex items-start justify-between gap-3 mb-6">
      <p class="text-sm text-text-secondary max-w-lg">A quién llamar cuando algo no se arregla adentro.</p>
      <button @click="openNew" class="flex items-center gap-1.5 bg-cyan text-navy font-extrabold text-sm px-5 py-2.5 rounded-full hover:shadow-lg transition-all cursor-pointer shrink-0">
        <span class="w-4 h-4 shrink-0" v-html="ICON_PLUS"></span>
        Nuevo proveedor técnico
      </button>
    </div>

    <!-- Loading -->
    <div v-if="loading" class="rounded-[20px] border border-border bg-white shadow-(--shadow-card) flex items-center justify-center py-16 text-text-muted text-sm">
      <svg class="animate-spin -ml-1 mr-3 h-5 w-5 text-navy" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24"><circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4"/><path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"/></svg>
      Cargando proveedores...
    </div>

    <!-- Error -->
    <div v-else-if="error" class="rounded-[20px] border border-border bg-white shadow-(--shadow-card) flex flex-col items-center justify-center py-16 text-center">
      <span class="w-10 h-10 mb-3 text-red opacity-60" v-html="ICON_WRENCH"></span>
      <p class="text-sm font-bold text-navy">{{ error }}</p>
      <button @click="load" class="mt-3 text-xs font-bold text-cyan hover:underline cursor-pointer">Reintentar</button>
    </div>

    <!-- Empty state -->
    <div v-else-if="providers.length === 0" class="rounded-[20px] border border-dashed border-border bg-white shadow-(--shadow-card) flex flex-col items-center justify-center py-20 text-center">
      <span class="w-12 h-12 mb-4 text-text-muted opacity-40" v-html="ICON_WRENCH"></span>
      <p class="text-base font-black text-navy">Todavía no cargaste ningún proveedor técnico</p>
      <p class="text-sm text-text-muted mt-1 max-w-sm">Sumá al plomero, electricista o técnico de A/C de confianza para tenerlos a mano.</p>
      <button @click="openNew" class="mt-5 flex items-center gap-1.5 bg-cyan text-navy font-extrabold text-sm px-5 py-2.5 rounded-full hover:shadow-lg transition-all cursor-pointer">
        <span class="w-4 h-4 shrink-0" v-html="ICON_PLUS"></span>
        Nuevo proveedor técnico
      </button>
    </div>

    <!-- Lista -->
    <div v-else class="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
      <div
        v-for="p in providers"
        :key="p.id"
        class="rounded-[20px] border border-border bg-white p-5 shadow-(--shadow-card) transition-transform duration-300 hover:-translate-y-0.5 flex flex-col"
      >
        <div class="flex items-start gap-3 mb-3">
          <div class="w-11 h-11 rounded-xl bg-navy/10 flex items-center justify-center shrink-0">
            <span class="text-sm font-black text-navy">{{ initials(p.name) }}</span>
          </div>
          <div class="min-w-0 flex-1">
            <div class="flex items-center gap-2">
              <h3 class="text-base font-black text-navy truncate">{{ p.name }}</h3>
              <span
                class="text-[9px] font-bold px-2 py-0.5 rounded-full shrink-0"
                :class="p.active === false ? 'bg-surface text-text-muted' : 'bg-teal/10 text-teal'"
              >{{ p.active === false ? 'Inactivo' : 'Activo' }}</span>
            </div>
            <p class="text-xs text-text-secondary mt-0.5 truncate">
              {{ p.specialty || 'Sin rubro' }}<template v-if="p.phone"> · {{ p.phone }}</template>
            </p>
          </div>
        </div>

        <div class="space-y-2 text-xs mb-4">
          <div class="flex items-center gap-2 text-text-secondary">
            <span class="w-3.5 h-3.5 shrink-0 text-text-muted" v-html="ICON_CLOCK"></span>
            <span>{{ scheduleLabel(p) }}</span>
          </div>
          <div v-if="p.rate" class="flex items-center gap-2 text-text-secondary">
            <span class="w-3.5 h-3.5 shrink-0 text-text-muted" v-html="ICON_WALLET"></span>
            <span>{{ p.rate }}</span>
          </div>
          <div v-if="p.address" class="flex items-center gap-2 text-text-secondary">
            <span class="w-3.5 h-3.5 shrink-0 text-text-muted" v-html="ICON_PIN"></span>
            <span class="truncate">{{ p.address }}</span>
          </div>
          <div v-if="p.email" class="flex items-center gap-2 text-text-secondary">
            <span class="w-3.5 h-3.5 shrink-0 text-text-muted" v-html="ICON_MAIL"></span>
            <span class="truncate">{{ p.email }}</span>
          </div>
        </div>

        <div class="flex items-center gap-4 justify-end pt-3 mt-auto border-t border-border">
          <button @click="openEdit(p)" class="text-[11px] font-bold text-text-secondary hover:text-navy transition-colors cursor-pointer">Editar</button>
          <button @click="askDelete(p)" class="text-[11px] font-bold text-text-secondary hover:text-red transition-colors cursor-pointer">Eliminar</button>
        </div>
      </div>
    </div>

    <!-- Modal: alta / edición -->
    <Transition name="modal-fade">
      <div v-if="showModal" class="fixed inset-0 bg-navy/40 backdrop-blur-sm flex items-center justify-center z-50 p-4">
        <div class="modal-panel bg-white rounded-[20px] shadow-2xl w-full max-w-lg max-h-[90vh] flex flex-col overflow-hidden">
          <div class="flex items-center justify-between px-7 pt-7 pb-5 shrink-0">
            <h3 class="text-xl font-black text-navy tracking-tight">{{ editing ? 'Editar proveedor técnico' : 'Nuevo proveedor técnico' }}</h3>
            <button @click="closeModal" class="w-8 h-8 rounded-full flex items-center justify-center text-text-muted hover:bg-surface hover:text-navy transition-colors cursor-pointer shrink-0">
              <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" stroke-width="2"><path stroke-linecap="round" stroke-linejoin="round" d="M6 18L18 6M6 6l12 12" /></svg>
            </button>
          </div>

          <div class="px-7 pb-7 overflow-y-auto flex-1">
            <div class="grid grid-cols-2 gap-4">
              <div class="col-span-2">
                <label class="block text-[11px] font-bold text-text-muted uppercase tracking-wide mb-1.5">Nombre *</label>
                <input v-model="form.name" maxlength="120" class="w-full px-4 py-2.5 bg-surface border border-border rounded-xl text-sm focus:outline-none focus:border-navy" :class="nameError ? 'border-red' : ''" placeholder="Ej: Juan el plomero">
                <p v-if="nameError" class="text-[10px] text-red mt-1">{{ nameError }}</p>
              </div>

              <div>
                <label class="block text-[11px] font-bold text-text-muted uppercase tracking-wide mb-1.5">Rubro</label>
                <input v-model="form.specialty" maxlength="80" class="w-full px-4 py-2.5 bg-surface border border-border rounded-xl text-sm focus:outline-none focus:border-navy" placeholder="Plomería, Electricidad...">
              </div>
              <div>
                <label class="block text-[11px] font-bold text-text-muted uppercase tracking-wide mb-1.5">Teléfono</label>
                <input v-model="form.phone" maxlength="40" class="w-full px-4 py-2.5 bg-surface border border-border rounded-xl text-sm focus:outline-none focus:border-navy" placeholder="809-555-0000">
              </div>

              <div>
                <label class="block text-[11px] font-bold text-text-muted uppercase tracking-wide mb-1.5">Email</label>
                <input v-model="form.email" type="email" maxlength="120" class="w-full px-4 py-2.5 bg-surface border border-border rounded-xl text-sm focus:outline-none focus:border-navy" placeholder="correo@ejemplo.com">
              </div>
              <div>
                <label class="block text-[11px] font-bold text-text-muted uppercase tracking-wide mb-1.5">Dirección / zona</label>
                <input v-model="form.address" maxlength="160" class="w-full px-4 py-2.5 bg-surface border border-border rounded-xl text-sm focus:outline-none focus:border-navy" placeholder="Zona / barrio">
              </div>

              <div class="col-span-2">
                <label class="block text-[11px] font-bold text-text-muted uppercase tracking-wide mb-1.5">Tarifa</label>
                <input v-model="form.rate" maxlength="120" class="w-full px-4 py-2.5 bg-surface border border-border rounded-xl text-sm focus:outline-none focus:border-navy" placeholder="Ej: RD$1500 por visita">
              </div>

              <div class="col-span-2">
                <label class="block text-[11px] font-bold text-text-muted uppercase tracking-wide mb-1.5">Días de trabajo</label>
                <div class="flex flex-wrap gap-1.5">
                  <button
                    v-for="d in DAYS"
                    :key="d.key"
                    type="button"
                    @click="toggleDay(d.key)"
                    class="px-3 py-1.5 rounded-full text-[11px] font-bold border transition-colors cursor-pointer"
                    :class="selectedDays.has(d.key) ? 'bg-navy text-white border-navy' : 'bg-white text-text-secondary border-border hover:border-navy/30'"
                  >{{ d.label }}</button>
                </div>
              </div>

              <div>
                <label class="block text-[11px] font-bold text-text-muted uppercase tracking-wide mb-1.5">Desde</label>
                <input v-model="form.workStart" type="time" class="w-full px-4 py-2.5 bg-surface border border-border rounded-xl text-sm focus:outline-none focus:border-navy">
              </div>
              <div>
                <label class="block text-[11px] font-bold text-text-muted uppercase tracking-wide mb-1.5">Hasta</label>
                <input v-model="form.workEnd" type="time" class="w-full px-4 py-2.5 bg-surface border border-border rounded-xl text-sm focus:outline-none focus:border-navy">
              </div>

              <div class="col-span-2">
                <label class="block text-[11px] font-bold text-text-muted uppercase tracking-wide mb-1.5">Notas</label>
                <textarea v-model="form.notes" rows="3" maxlength="500" class="w-full px-4 py-2.5 bg-surface border border-border rounded-xl text-sm focus:outline-none focus:border-navy resize-none" placeholder="Detalles, referencias, disponibilidad..."></textarea>
              </div>

              <div class="col-span-2 flex items-center gap-2">
                <input id="tp-active" v-model="form.active" type="checkbox" class="w-4 h-4 accent-cyan cursor-pointer">
                <label for="tp-active" class="text-xs font-bold text-text-secondary cursor-pointer">Proveedor activo</label>
              </div>
            </div>
          </div>

          <div class="flex items-center gap-4 justify-end px-7 py-5 border-t border-border shrink-0">
            <button @click="closeModal" class="text-sm font-bold text-text-secondary hover:text-navy cursor-pointer transition-colors">Cancelar</button>
            <button @click="save" :disabled="saving" class="px-5 py-2.5 bg-navy text-white rounded-full text-sm font-extrabold cursor-pointer transition-colors disabled:opacity-50 disabled:cursor-not-allowed">
              {{ saving ? 'Guardando...' : (editing ? 'Guardar cambios' : 'Crear proveedor') }}
            </button>
          </div>
        </div>
      </div>
    </Transition>

    <!-- Modal: confirmar eliminación -->
    <Transition name="modal-fade">
      <div v-if="deleteTarget" class="fixed inset-0 bg-navy/40 backdrop-blur-sm flex items-center justify-center z-50 p-4">
        <div class="modal-panel bg-white rounded-[20px] shadow-2xl w-full max-w-sm overflow-hidden">
          <div class="px-7 pt-7 pb-5">
            <h3 class="text-lg font-black text-navy tracking-tight">Eliminar proveedor</h3>
            <p class="text-sm text-text-secondary mt-2">
              ¿Seguro que querés eliminar a <span class="font-bold text-navy">{{ deleteTarget.name }}</span>? Esta acción no se puede deshacer.
            </p>
          </div>
          <div class="flex items-center gap-4 justify-end px-7 py-5 border-t border-border">
            <button @click="deleteTarget = null" class="text-sm font-bold text-text-secondary hover:text-navy cursor-pointer transition-colors">Cancelar</button>
            <button @click="confirmDelete" :disabled="deleting" class="px-5 py-2.5 bg-red text-white rounded-full text-sm font-extrabold cursor-pointer transition-colors disabled:opacity-50 disabled:cursor-not-allowed">
              {{ deleting ? 'Eliminando...' : 'Eliminar' }}
            </button>
          </div>
        </div>
      </div>
    </Transition>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, onMounted } from 'vue'
import { useAuthStore } from '@/stores/auth.store'
import { useToast } from '@/composables/useToast'
import {
  TechnicalProvidersService,
  type TechnicalProvider,
  type CreateTechnicalProviderInput,
} from '@/services/TechnicalProviders.service'

const auth = useAuthStore()
const toast = useToast()
const hotelId = computed(() =>
  auth.user?.hotelId && auth.user.hotelId !== 'platform' ? auth.user.hotelId : undefined
)

const ICON_PLUS = '<svg viewBox="0 0 24 24" class="w-full h-full" fill="none" stroke="currentColor" stroke-width="2.5"><path stroke-linecap="round" stroke-linejoin="round" d="M12 4.5v15m7.5-7.5h-15"/></svg>'
const ICON_CLOCK = '<svg viewBox="0 0 24 24" class="w-full h-full" fill="none" stroke="currentColor" stroke-width="1.8"><path stroke-linecap="round" stroke-linejoin="round" d="M12 6v6h4.5m4.5 0a9 9 0 1 1-18 0 9 9 0 0 1 18 0Z"/></svg>'
const ICON_WALLET = '<svg viewBox="0 0 24 24" class="w-full h-full" fill="none" stroke="currentColor" stroke-width="1.6"><path stroke-linecap="round" stroke-linejoin="round" d="M3 7a2 2 0 0 1 2-2h12a2 2 0 0 1 2 2v10a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V7Z"/><path stroke-linecap="round" stroke-linejoin="round" d="M16 12h.01M3 10h18"/></svg>'
const ICON_PIN = '<svg viewBox="0 0 24 24" class="w-full h-full" fill="none" stroke="currentColor" stroke-width="1.7"><path stroke-linecap="round" stroke-linejoin="round" d="M15 10.5a3 3 0 1 1-6 0 3 3 0 0 1 6 0Z"/><path stroke-linecap="round" stroke-linejoin="round" d="M19.5 10.5c0 7.142-7.5 11.25-7.5 11.25S4.5 17.642 4.5 10.5a7.5 7.5 0 1 1 15 0Z"/></svg>'
const ICON_MAIL = '<svg viewBox="0 0 24 24" class="w-full h-full" fill="none" stroke="currentColor" stroke-width="1.7"><path stroke-linecap="round" stroke-linejoin="round" d="M21.75 6.75v10.5a2.25 2.25 0 0 1-2.25 2.25h-15a2.25 2.25 0 0 1-2.25-2.25V6.75m19.5 0A2.25 2.25 0 0 0 19.5 4.5h-15a2.25 2.25 0 0 0-2.25 2.25m19.5 0v.243a2.25 2.25 0 0 1-1.07 1.916l-7.5 4.615a2.25 2.25 0 0 1-2.36 0L3.32 8.91a2.25 2.25 0 0 1-1.07-1.916V6.75"/></svg>'
const ICON_WRENCH = '<svg viewBox="0 0 24 24" class="w-full h-full" fill="none" stroke="currentColor" stroke-width="1.6"><path stroke-linecap="round" stroke-linejoin="round" d="M11.42 15.17 17.25 21A2.652 2.652 0 0 0 21 17.25l-5.877-5.877M11.42 15.17l2.496-3.03c.317-.384.74-.626 1.208-.766M11.42 15.17l-4.655 5.653a2.548 2.548 0 1 1-3.586-3.586l6.837-5.63m5.108-.233c.55-.164 1.163-.188 1.743-.14a4.5 4.5 0 0 0 4.486-6.336l-3.276 3.277a3.004 3.004 0 0 1-2.25-2.25l3.276-3.276a4.5 4.5 0 0 0-6.336 4.486c.091 1.076-.071 2.264-.904 2.95l-.102.085"/></svg>'

// Orden canónico de días (inglés) + etiqueta corta ES.
const DAYS: Array<{ key: string; label: string }> = [
  { key: 'mon', label: 'Lun' },
  { key: 'tue', label: 'Mar' },
  { key: 'wed', label: 'Mié' },
  { key: 'thu', label: 'Jue' },
  { key: 'fri', label: 'Vie' },
  { key: 'sat', label: 'Sáb' },
  { key: 'sun', label: 'Dom' },
]
const DAY_ORDER = DAYS.map(d => d.key)
const DAY_LABEL: Record<string, string> = Object.fromEntries(DAYS.map(d => [d.key, d.label]))

const providers = ref<TechnicalProvider[]>([])
const loading = ref(false)
const error = ref('')

const showModal = ref(false)
const editing = ref<TechnicalProvider | null>(null)
const saving = ref(false)
const nameError = ref('')
const selectedDays = ref<Set<string>>(new Set())

const deleteTarget = ref<TechnicalProvider | null>(null)
const deleting = ref(false)

interface ProviderForm {
  name: string
  specialty: string
  phone: string
  email: string
  address: string
  rate: string
  notes: string
  workStart: string
  workEnd: string
  active: boolean
}

function emptyForm(): ProviderForm {
  return { name: '', specialty: '', phone: '', email: '', address: '', rate: '', notes: '', workStart: '', workEnd: '', active: true }
}
const form = ref<ProviderForm>(emptyForm())

onMounted(load)

async function load() {
  loading.value = true
  error.value = ''
  try {
    providers.value = await TechnicalProvidersService.list()
  } catch {
    error.value = 'No se pudieron cargar los proveedores técnicos.'
  } finally {
    loading.value = false
  }
}

function initials(name: string): string {
  return name.split(' ').filter(Boolean).slice(0, 2).map(n => n[0]?.toUpperCase() ?? '').join('') || '?'
}

// CSV de días → etiqueta legible. "Lun a Vie" si es un tramo contiguo, si no "Lun, Mié, Vie".
function daysLabel(csv?: string): string {
  const set = parseDays(csv)
  if (set.length === 0) return ''
  if (set.length === 1) return DAY_LABEL[set[0]!] ?? ''
  const idxs = set.map(k => DAY_ORDER.indexOf(k)).sort((a, b) => a - b)
  const contiguous = idxs.every((v, i) => i === 0 || v === idxs[i - 1]! + 1)
  if (contiguous && idxs.length >= 3) {
    return `${DAY_LABEL[DAY_ORDER[idxs[0]!]!]} a ${DAY_LABEL[DAY_ORDER[idxs[idxs.length - 1]!]!]}`
  }
  return idxs.map(i => DAY_LABEL[DAY_ORDER[i]!]).join(', ')
}

// Normaliza el CSV al orden canónico y descarta claves desconocidas.
function parseDays(csv?: string): string[] {
  if (!csv) return []
  const raw = new Set(csv.split(',').map(s => s.trim().toLowerCase()).filter(Boolean))
  return DAY_ORDER.filter(k => raw.has(k))
}

function timeLabel(p: TechnicalProvider): string {
  if (p.workStart && p.workEnd) return `${p.workStart}–${p.workEnd}`
  if (p.workStart) return `desde ${p.workStart}`
  if (p.workEnd) return `hasta ${p.workEnd}`
  return ''
}

function scheduleLabel(p: TechnicalProvider): string {
  const days = daysLabel(p.workDays)
  const time = timeLabel(p)
  if (days && time) return `${days} · ${time}`
  return days || time || 'Horario sin definir'
}

function toggleDay(key: string) {
  const next = new Set(selectedDays.value)
  if (next.has(key)) next.delete(key)
  else next.add(key)
  selectedDays.value = next
}

function openNew() {
  editing.value = null
  nameError.value = ''
  form.value = emptyForm()
  selectedDays.value = new Set()
  showModal.value = true
}

function openEdit(p: TechnicalProvider) {
  editing.value = p
  nameError.value = ''
  form.value = {
    name: p.name ?? '',
    specialty: p.specialty ?? '',
    phone: p.phone ?? '',
    email: p.email ?? '',
    address: p.address ?? '',
    rate: p.rate ?? '',
    notes: p.notes ?? '',
    workStart: p.workStart ?? '',
    workEnd: p.workEnd ?? '',
    active: p.active !== false,
  }
  selectedDays.value = new Set(parseDays(p.workDays))
  showModal.value = true
}

function closeModal() {
  showModal.value = false
}

function serializeDays(): string {
  return DAY_ORDER.filter(k => selectedDays.value.has(k)).join(',')
}

async function save() {
  nameError.value = ''
  const name = form.value.name.trim()
  if (!name) {
    nameError.value = 'El nombre es obligatorio.'
    return
  }
  saving.value = true
  const payload: CreateTechnicalProviderInput = {
    hotelId: hotelId.value,
    name,
    specialty: form.value.specialty.trim() || undefined,
    phone: form.value.phone.trim() || undefined,
    email: form.value.email.trim() || undefined,
    address: form.value.address.trim() || undefined,
    rate: form.value.rate.trim() || undefined,
    notes: form.value.notes.trim() || undefined,
    workDays: serializeDays() || undefined,
    workStart: form.value.workStart || undefined,
    workEnd: form.value.workEnd || undefined,
    active: form.value.active,
  }
  try {
    if (editing.value) {
      await TechnicalProvidersService.update(editing.value.id, payload)
      toast.success('Proveedor técnico actualizado')
    } else {
      await TechnicalProvidersService.create(payload)
      toast.success('Proveedor técnico creado')
    }
    showModal.value = false
    editing.value = null
    await load()
  } catch {
    toast.error(editing.value ? 'Error al actualizar el proveedor' : 'Error al crear el proveedor')
  } finally {
    saving.value = false
  }
}

function askDelete(p: TechnicalProvider) {
  deleteTarget.value = p
}

async function confirmDelete() {
  if (!deleteTarget.value) return
  deleting.value = true
  try {
    await TechnicalProvidersService.remove(deleteTarget.value.id)
    toast.success('Proveedor técnico eliminado')
    deleteTarget.value = null
    await load()
  } catch {
    toast.error('Error al eliminar el proveedor')
  } finally {
    deleting.value = false
  }
}
</script>

<style scoped>
.modal-fade-enter-active,
.modal-fade-leave-active {
  transition: opacity 0.2s ease;
}
.modal-fade-enter-from,
.modal-fade-leave-to {
  opacity: 0;
}
.modal-fade-enter-active .modal-panel,
.modal-fade-leave-active .modal-panel {
  transition: transform 0.25s cubic-bezier(0.16, 1, 0.3, 1), opacity 0.2s ease;
}
.modal-fade-enter-from .modal-panel,
.modal-fade-leave-to .modal-panel {
  opacity: 0;
  transform: scale(0.95) translateY(12px);
}
</style>
