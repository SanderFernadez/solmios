<template>
  <div>
    <!-- Header -->
    <div class="flex items-center justify-between mb-6 flex-wrap gap-3">
      <div>
        <h2 class="text-xl font-black text-navy">Activos</h2>
        <p class="text-sm text-text-muted mt-0.5">Bienes físicos del hotel y a qué empleado están asignados</p>
      </div>
      <button @click="openNew" class="flex items-center gap-1.5 bg-cyan text-navy font-extrabold text-sm px-5 py-2.5 rounded-full hover:shadow-lg transition-all cursor-pointer">
        <span class="w-4 h-4 shrink-0" v-html="ICON_PLUS"></span>
        Nuevo Activo
      </button>
    </div>

    <!-- Nota explicativa: qué es Activos y en qué se diferencia de Equipo -->
    <div class="mb-6 rounded-2xl border border-navy/10 bg-navy/5 p-4">
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

    <!-- KPIs -->
    <div class="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-4 mb-6">
      <KpiHeroCard label="Total Activos" :value="totalCount" icon="building" accent="blue"
        unit="Bienes registrados en el hotel" />
      <KpiHeroCard label="Disponibles" :value="availableCount" icon="bookings" accent="teal"
        unit="Listos para entregar" :progress="availableShare" />
      <KpiHeroCard label="Asignados" :value="assignedCount" icon="users" accent="purple"
        unit="En manos de un empleado" :progress="assignedShare" />
      <KpiHeroCard label="Retirados" :value="retiredCount" icon="checkout" accent="amber"
        unit="Fuera de circulación" />
    </div>

    <!-- Listado -->
    <SectionCard title="Inventario de activos" :subtitle="`${filtered.length} de ${totalCount} activo(s)`" body-class="p-0">
      <template #actions>
        <select v-model="activeFilter"
          class="px-3 py-2 rounded-lg border border-white/15 bg-white/10 text-sm font-semibold text-white focus:outline-none focus:border-cyan cursor-pointer">
          <option v-for="f in filters" :key="f.value" class="text-navy" :value="f.value">{{ f.label }}</option>
        </select>
      </template>

      <!-- Skeleton -->
      <div v-if="loading" class="p-4 sm:p-5 space-y-3">
        <div v-for="i in 5" :key="i" class="flex items-center gap-4">
          <div class="h-4 w-1/3 animate-pulse rounded bg-surface"></div>
          <div class="h-4 w-24 animate-pulse rounded bg-surface"></div>
          <div class="h-4 w-20 animate-pulse rounded bg-surface"></div>
          <div class="h-4 flex-1 animate-pulse rounded bg-surface"></div>
        </div>
      </div>

      <EmptyState
        v-else-if="!filtered.length"
        :icon="ICON_BOX_EMPTY"
        :title="activeFilter !== 'all' ? 'Sin resultados' : 'Todavía no hay activos'"
        :message="activeFilter !== 'all' ? 'No hay activos en este estado. Probá con otro filtro.' : 'Registrá el primer bien del hotel para saber quién tiene cada cosa.'"
      >
        <template #action>
          <button v-if="activeFilter !== 'all'" @click="activeFilter = 'all'"
            class="px-5 py-2.5 rounded-full border border-border text-sm font-bold text-navy hover:bg-surface transition-colors cursor-pointer">
            Limpiar filtros
          </button>
          <button v-else @click="openNew"
            class="px-5 py-2.5 bg-navy text-white rounded-full text-sm font-bold hover:bg-navy-light transition-colors cursor-pointer">
            Nuevo Activo
          </button>
        </template>
      </EmptyState>

      <div v-else class="overflow-x-auto">
        <table class="w-full min-w-[760px] tbl-head">
          <thead>
            <tr>
              <th class="text-left px-4 py-3 text-[10px]">Activo</th>
              <th class="text-left px-4 py-3 text-[10px] hidden lg:table-cell">Categoría</th>
              <th class="text-left px-4 py-3 text-[10px] hidden lg:table-cell">Serie</th>
              <th class="text-left px-4 py-3 text-[10px]">Estado</th>
              <th class="text-left px-4 py-3 text-[10px]">Asignado a</th>
              <th class="text-right px-4 py-3 text-[10px]">Acciones</th>
            </tr>
          </thead>
          <tbody>
            <tr v-for="a in filtered" :key="a.id" class="border-b border-border last:border-0 hover:bg-surface/60 transition-colors">
              <td class="px-4 py-3">
                <div class="text-sm font-bold text-navy">{{ a.name }}</div>
                <!-- En <lg las columnas Categoría/Serie están ocultas: suben como línea secundaria -->
                <div class="text-[11px] text-text-muted lg:hidden">
                  {{ catLabel(a.category) }}<template v-if="a.serialNumber"> · S/N {{ a.serialNumber }}</template>
                </div>
              </td>
              <td class="px-4 py-3 text-sm text-text-secondary hidden lg:table-cell">{{ catLabel(a.category) }}</td>
              <td class="px-4 py-3 hidden lg:table-cell">
                <span v-if="a.serialNumber" class="text-sm text-text-secondary tabular-nums">{{ a.serialNumber }}</span>
                <span v-else class="text-sm text-text-muted">Sin número</span>
              </td>
              <td class="px-4 py-3">
                <span class="inline-flex items-center rounded-full px-2.5 py-1 text-[10px] font-extrabold uppercase tracking-wide" :class="statusClass(a.status)">
                  {{ statusLabel(a.status) }}
                </span>
              </td>
              <td class="px-4 py-3">
                <span v-if="a.assignedTo" class="text-sm font-semibold text-navy">{{ employeeName(a.assignedTo) }}</span>
                <span v-else class="text-sm text-text-muted">Sin asignar</span>
              </td>
              <td class="px-4 py-3 text-right">
                <div class="flex items-center justify-end gap-1.5">
                  <button v-if="a.status === 'available'" @click="openAssign(a)" title="Asignar a un empleado"
                    class="grid h-8 w-8 place-items-center rounded-lg text-text-muted hover:bg-navy/10 hover:text-navy transition-colors cursor-pointer">
                    <span class="h-4 w-4" v-html="ICON_USER_PLUS"></span>
                  </button>
                  <button v-if="a.status === 'assigned'" @click="doReturn(a)" title="Devolver al inventario"
                    class="grid h-8 w-8 place-items-center rounded-lg text-text-muted hover:bg-teal/10 hover:text-teal transition-colors cursor-pointer">
                    <span class="h-4 w-4" v-html="ICON_RETURN"></span>
                  </button>
                  <button @click="del(a)" title="Eliminar activo"
                    class="grid h-8 w-8 place-items-center rounded-lg text-text-muted hover:bg-coral/10 hover:text-coral transition-colors cursor-pointer">
                    <span class="h-4 w-4" v-html="ICON_TRASH"></span>
                  </button>
                </div>
              </td>
            </tr>
          </tbody>
        </table>
      </div>
    </SectionCard>

    <FormModal v-if="modal" :title="modal.title" :fields="modal.fields" :loading="saving" :submit-label="modal.submitLabel"
      @close="modal = null" @submit="modal.onSubmit" />
  </div>
</template>

<script setup lang="ts">
import { ref, computed, onMounted } from 'vue'
import { AssetsService, type Asset, ASSET_CATEGORY_LABELS, ASSET_STATUS_LABELS } from '@/services/Assets.service'
import { EmpleadosService, type EmployeeProfile } from '@/services/Empleados.service'
import FormModal, { type FormField } from '@/components/features/FormModal.vue'
import KpiHeroCard from '@/components/features/dashboard/KpiHeroCard.vue'
import SectionCard from '@/components/ui/SectionCard.vue'
import EmptyState from '@/components/ui/EmptyState.vue'
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

// KPIs — sólo los estados que realmente existen en el modelo (available/assigned/retired)
const totalCount = computed(() => assets.value.length)
const availableCount = computed(() => assets.value.filter((a) => a.status === 'available').length)
const assignedCount = computed(() => assets.value.filter((a) => a.status === 'assigned').length)
const retiredCount = computed(() => assets.value.filter((a) => a.status === 'retired').length)
const availableShare = computed(() => totalCount.value ? Math.round((availableCount.value / totalCount.value) * 100) : 0)
const assignedShare = computed(() => totalCount.value ? Math.round((assignedCount.value / totalCount.value) * 100) : 0)

const catLabel = (c: string) => ASSET_CATEGORY_LABELS[c] ?? c
const statusLabel = (s: string) => ASSET_STATUS_LABELS[s] ?? s
function statusClass(s: string) {
  return { available: 'bg-teal/10 text-teal', assigned: 'bg-cyan/10 text-cyan', retired: 'bg-gray-100 text-gray-500' }[s] ?? 'bg-gray-100 text-gray-500'
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

// Iconos SVG inline (el <svg> ocupa el 100% del <span> contenedor, que define el tamaño)
const ICON_PLUS = '<svg viewBox="0 0 24 24" class="w-full h-full" fill="none" stroke="currentColor" stroke-width="2.5"><path stroke-linecap="round" stroke-linejoin="round" d="M12 4.5v15m7.5-7.5h-15"/></svg>'
const ICON_USER_PLUS = '<svg viewBox="0 0 24 24" class="w-full h-full" fill="none" stroke="currentColor" stroke-width="1.8"><path stroke-linecap="round" stroke-linejoin="round" d="M18 7.5v3m0 0v3m0-3h3m-3 0h-3m-2.25-4.125a3.375 3.375 0 1 1-6.75 0 3.375 3.375 0 0 1 6.75 0ZM3 19.235v-.11a6.375 6.375 0 0 1 12.75 0v.109A12.318 12.318 0 0 1 9.374 21c-2.331 0-4.512-.645-6.374-1.766Z"/></svg>'
const ICON_RETURN = '<svg viewBox="0 0 24 24" class="w-full h-full" fill="none" stroke="currentColor" stroke-width="1.8"><path stroke-linecap="round" stroke-linejoin="round" d="M9 15 3 9m0 0 6-6M3 9h12a6 6 0 0 1 0 12h-3"/></svg>'
const ICON_TRASH = '<svg viewBox="0 0 24 24" class="w-full h-full" fill="none" stroke="currentColor" stroke-width="1.8"><path stroke-linecap="round" stroke-linejoin="round" d="m14.74 9-.346 9m-4.788 0L9.26 9m9.968-3.21c.342.052.682.107 1.022.166m-1.022-.165L18.16 19.673a2.25 2.25 0 0 1-2.244 2.077H8.084a2.25 2.25 0 0 1-2.244-2.077L4.772 5.79m14.456 0a48.108 48.108 0 0 0-3.478-.397m-12 .562c.34-.059.68-.114 1.022-.165m0 0a48.11 48.11 0 0 1 3.478-.397m7.5 0v-.916c0-1.18-.91-2.164-2.09-2.201a51.964 51.964 0 0 0-3.32 0c-1.18.037-2.09 1.022-2.09 2.201v.916m7.5 0a48.667 48.667 0 0 0-7.5 0"/></svg>'
const ICON_BOX_EMPTY = '<svg viewBox="0 0 24 24" class="h-8 w-8" fill="none" stroke="currentColor" stroke-width="1.5"><path stroke-linecap="round" stroke-linejoin="round" d="m20.25 7.5-.625 10.632a2.25 2.25 0 0 1-2.247 2.118H6.622a2.25 2.25 0 0 1-2.247-2.118L3.75 7.5m8.25 3v6.75m0 0-3-3m3 3 3-3M3.375 7.5h17.25c.621 0 1.125-.504 1.125-1.125v-1.5c0-.621-.504-1.125-1.125-1.125H3.375c-.621 0-1.125.504-1.125 1.125v1.5c0 .621.504 1.125 1.125 1.125Z"/></svg>'
</script>
