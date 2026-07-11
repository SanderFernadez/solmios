<template>
  <div>
    <div class="flex items-center justify-between mb-4 flex-wrap gap-3">
      <div>
        <h2 class="text-xl font-black text-navy">Activos</h2>
        <p class="text-sm text-text-muted mt-0.5">Bienes físicos del hotel y a qué empleado están asignados</p>
      </div>
      <button @click="openNew" class="flex items-center gap-1.5 bg-cyan text-navy font-extrabold text-sm px-5 py-2.5 rounded-xl hover:shadow-lg transition-all cursor-pointer">
        <span class="text-lg leading-none">+</span>Nuevo Activo
      </button>
    </div>

    <!-- Nota explicativa: qué es Activos y en qué se diferencia de Equipo -->
    <div class="mb-5 p-4 rounded-xl bg-navy/5 border border-navy/10">
      <div class="flex items-start gap-2.5">
        <span class="text-lg leading-none">💡</span>
        <div class="text-xs text-text-secondary leading-relaxed">
          <b class="text-navy">¿Qué es esto?</b> Acá registrás los <b>bienes físicos del hotel</b> (uniformes, llaves,
          radios, laptops, tablets) y a qué empleado se los entregaste.
          <span class="block mt-1">
            No confundir con <b class="text-navy">Equipo</b>, que son las <b>cuentas del personal</b> (quién trabaja acá).
            <b class="text-navy">Activos</b> son <b>las cosas</b> que le prestás a esa gente.
          </span>
          <span class="block mt-1 text-text-muted">
            Sirve para saber, cuando un empleado se va, qué tiene que <b>devolver</b> (su llave maestra, el uniforme, el radio).
          </span>
        </div>
      </div>
    </div>

    <div class="flex gap-2 mb-4 flex-wrap">
      <button v-for="f in filters" :key="f.value" @click="activeFilter = f.value"
        class="px-3 py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer"
        :class="activeFilter === f.value ? 'bg-navy text-white' : 'bg-white text-text-secondary border border-border hover:border-navy/30'">
        {{ f.label }}
      </button>
    </div>

    <div v-if="loading" class="flex items-center justify-center py-20">
      <div class="w-8 h-8 border-4 border-navy/20 border-t-navy rounded-full animate-spin"></div>
    </div>

    <div v-else-if="!filtered.length" class="card p-12 text-center">
      <p class="text-sm text-text-muted">No hay activos {{ activeFilter !== 'all' ? 'en este estado' : 'cargados' }}.</p>
    </div>

    <div v-else class="card overflow-x-auto">
      <table class="w-full text-sm">
        <thead>
          <tr class="border-b border-border bg-surface/50 text-left">
            <th class="px-4 py-2.5 text-[10px] font-bold text-text-muted uppercase">Activo</th>
            <th class="px-4 py-2.5 text-[10px] font-bold text-text-muted uppercase">Categoría</th>
            <th class="px-4 py-2.5 text-[10px] font-bold text-text-muted uppercase">Serie</th>
            <th class="px-4 py-2.5 text-[10px] font-bold text-text-muted uppercase">Estado</th>
            <th class="px-4 py-2.5 text-[10px] font-bold text-text-muted uppercase">Asignado a</th>
            <th class="px-4 py-2.5 text-[10px] font-bold text-text-muted uppercase text-right">Acciones</th>
          </tr>
        </thead>
        <tbody>
          <tr v-for="a in filtered" :key="a.id" class="border-b border-border/50 last:border-0 hover:bg-surface/30">
            <td class="px-4 py-2.5 font-bold text-navy">{{ a.name }}</td>
            <td class="px-4 py-2.5 text-text-secondary">{{ catLabel(a.category) }}</td>
            <td class="px-4 py-2.5 text-text-muted">{{ a.serialNumber || '—' }}</td>
            <td class="px-4 py-2.5">
              <span class="text-[10px] font-bold px-2 py-1 rounded-full" :class="statusClass(a.status)">{{ statusLabel(a.status) }}</span>
            </td>
            <td class="px-4 py-2.5 text-text-secondary">{{ a.assignedTo ? employeeName(a.assignedTo) : '—' }}</td>
            <td class="px-4 py-2.5 text-right whitespace-nowrap">
              <button v-if="a.status === 'available'" @click="openAssign(a)" class="px-2.5 py-1 bg-cyan/15 text-navy rounded-lg text-[10px] font-bold hover:bg-cyan/25 cursor-pointer mr-1">Asignar</button>
              <button v-if="a.status === 'assigned'" @click="doReturn(a)" class="px-2.5 py-1 bg-teal/15 text-teal rounded-lg text-[10px] font-bold hover:bg-teal/25 cursor-pointer mr-1">Devolver</button>
              <button @click="del(a)" class="px-2.5 py-1 bg-coral/10 text-coral rounded-lg text-[10px] font-bold hover:bg-coral/20 cursor-pointer">Eliminar</button>
            </td>
          </tr>
        </tbody>
      </table>
    </div>

    <FormModal v-if="modal" :title="modal.title" :fields="modal.fields" :loading="saving" :submit-label="modal.submitLabel"
      @close="modal = null" @submit="modal.onSubmit" />
  </div>
</template>

<script setup lang="ts">
import { ref, computed, onMounted } from 'vue'
import { AssetsService, type Asset, ASSET_CATEGORY_LABELS, ASSET_STATUS_LABELS } from '@/services/Assets.service'
import { EmpleadosService, type EmployeeProfile } from '@/services/Empleados.service'
import FormModal, { type FormField } from '@/components/features/FormModal.vue'
import { useToast } from '@/composables/useToast'
import { useAuthStore } from '@/stores/auth.store'

const toast = useToast()
const auth = useAuthStore()
const hotelId = computed(() => (auth.user?.hotelId && auth.user.hotelId !== 'platform' ? auth.user.hotelId : undefined))
const loading = ref(true)
const saving = ref(false)
const assets = ref<Asset[]>([])
const profiles = ref<EmployeeProfile[]>([])
const activeFilter = ref('all')

const filters = [
  { value: 'all', label: 'Todos' },
  { value: 'available', label: 'Disponibles' },
  { value: 'assigned', label: 'Asignados' },
  { value: 'retired', label: 'Retirados' },
]
const filtered = computed(() => activeFilter.value === 'all' ? assets.value : assets.value.filter((a) => a.status === activeFilter.value))

const catLabel = (c: string) => ASSET_CATEGORY_LABELS[c] ?? c
const statusLabel = (s: string) => ASSET_STATUS_LABELS[s] ?? s
function statusClass(s: string) {
  return { available: 'bg-teal/10 text-teal', assigned: 'bg-cyan/10 text-cyan', retired: 'bg-gray-100 text-gray-500' }[s] ?? 'bg-gray-100'
}
function employeeName(id: string): string {
  const p = profiles.value.find((x) => x.id === id)
  return p?.userName || p?.position || id.slice(0, 6)
}

async function load() {
  loading.value = true
  try {
    const [a, pr] = await Promise.all([AssetsService.list(), EmpleadosService.listProfiles(hotelId.value ? { hotelId: hotelId.value } : undefined)])
    assets.value = a
    profiles.value = pr.data ?? []
  } catch { toast.error('No se pudieron cargar los activos') }
  finally { loading.value = false }
}
onMounted(load)

const modal = ref<{ title: string; submitLabel: string; fields: FormField[]; onSubmit: (v: Record<string, string | number>) => Promise<void> } | null>(null)

function openNew() {
  modal.value = {
    title: 'Nuevo Activo', submitLabel: 'Crear',
    fields: [
      { key: 'name', label: 'Nombre del bien', required: true, minLength: 2, maxLength: 120, placeholder: 'Radio Motorola, Uniforme talle M, Laptop Dell…',
        hint: 'Qué objeto es (el bien que vas a entregar).' },
      { key: 'category', label: 'Categoría', type: 'select', default: 'equipment', options: Object.entries(ASSET_CATEGORY_LABELS).map(([value, label]) => ({ value, label })),
        hint: 'Qué tipo de bien es (uniforme, llave, equipamiento, dispositivo…).' },
      // Asignar al empleado en el mismo paso: el punto de Activos es saber quién tiene cada cosa.
      { key: 'assignTo', label: 'Entregar a (empleado)', type: 'select', options: profiles.value.map((p) => ({ value: p.id, label: p.userName || p.position || p.id.slice(0, 6) })),
        hint: 'A qué empleado se lo das. Dejalo vacío si todavía no se lo entregás a nadie (queda Disponible).' },
      { key: 'serialNumber', label: 'Número de serie', maxLength: 100,
        hint: 'Opcional. Para equipos con número de serie (laptops, radios).' },
      { key: 'notes', label: 'Notas', type: 'textarea', maxLength: 500,
        hint: 'Opcional. Estado, color, detalles.' },
    ],
    onSubmit: async (v) => {
      saving.value = true
      try {
        const asset = await AssetsService.create({ name: String(v.name).trim(), category: String(v.category), serialNumber: String(v.serialNumber || '') || undefined, notes: String(v.notes || '') || undefined })
        // Si eligió empleado, se lo asigna en el mismo paso.
        if (v.assignTo) await AssetsService.assign(asset.id, String(v.assignTo))
        toast.success(v.assignTo ? 'Activo creado y entregado' : 'Activo creado'); modal.value = null; await load()
      } catch (e: unknown) { toast.error(e instanceof Error ? e.message : 'Error al crear') }
      finally { saving.value = false }
    },
  }
}

function openAssign(a: Asset) {
  if (!profiles.value.length) { toast.warning('No hay empleados con legajo para asignar'); return }
  modal.value = {
    title: `Asignar: ${a.name}`, submitLabel: 'Asignar',
    fields: [
      { key: 'employeeId', label: 'Empleado', type: 'select', required: true, options: profiles.value.map((p) => ({ value: p.id, label: p.userName || p.position || p.id.slice(0, 6) })) },
    ],
    onSubmit: async (v) => {
      saving.value = true
      try { await AssetsService.assign(a.id, String(v.employeeId)); toast.success('Activo asignado'); modal.value = null; await load() }
      catch (e: unknown) { toast.error(e instanceof Error ? e.message : 'Error al asignar') }
      finally { saving.value = false }
    },
  }
}

async function doReturn(a: Asset) {
  try { await AssetsService.returnAsset(a.id); toast.success('Activo devuelto al inventario'); await load() }
  catch { toast.error('Error al devolver') }
}

async function del(a: Asset) {
  if (!confirm(`¿Eliminar el activo "${a.name}"?`)) return
  try { await AssetsService.remove(a.id); toast.success('Activo eliminado'); await load() }
  catch { toast.error('Error al eliminar') }
}
</script>
