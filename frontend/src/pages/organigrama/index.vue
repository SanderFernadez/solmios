<template>
  <div>
    <!-- Header -->
    <div class="flex items-center justify-between mb-6 gap-3 flex-wrap">
      <div>
        <h2 class="text-xl font-black text-navy">Organigrama</h2>
        <p class="text-sm text-text-muted mt-0.5">Estructura de departamentos y personal del hotel</p>
      </div>
      <router-link
        to="/panel/rrhh/empleados"
        class="inline-flex items-center gap-1.5 rounded-full border border-border px-4 py-2 text-xs font-bold text-navy hover:bg-surface transition-colors"
      >
        <span class="h-3.5 w-3.5 shrink-0" v-html="ICONS.back"></span>
        Volver a Empleados
      </router-link>
    </div>

    <!-- KPIs -->
    <div v-if="!loading && roots.length" class="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-4 mb-6">
      <KpiHeroCard
        label="Total Empleados"
        :value="total"
        icon="users"
        accent="blue"
        :unit="`Distribuidos en ${departmentCount} departamento(s)`"
      />
      <KpiHeroCard
        label="Departamentos"
        :value="departmentCount"
        icon="building"
        accent="purple"
        :unit="`${levelCount} nivel(es) jerárquico(s)`"
      />
      <KpiHeroCard
        label="Con Personal"
        :value="staffedCount"
        icon="bookings"
        accent="teal"
        :unit="emptyCount ? `${emptyCount} sin personal asignado` : 'Todos los departamentos cubiertos'"
        :progress="staffedShare"
      />
    </div>

    <!-- Lienzo del árbol -->
    <SectionCard
      title="Estructura organizacional"
      :subtitle="chartSubtitle"
      body-class="p-0"
    >
      <template #actions>
        <div v-if="roots.length" class="flex items-center gap-1 rounded-lg border border-white/15 bg-white/10 px-1 py-1">
          <button
            type="button"
            aria-label="Alejar"
            :disabled="zoom <= ZOOM_MIN"
            @click="zoomOut"
            class="grid h-7 w-7 place-items-center rounded-md text-white/80 hover:bg-white/15 hover:text-white disabled:opacity-35 disabled:cursor-not-allowed transition-colors cursor-pointer"
          >
            <span class="h-4 w-4" v-html="ICONS.minus"></span>
          </button>
          <span class="min-w-[46px] text-center text-[11px] font-extrabold tabular-nums text-white">{{ zoomLabel }}</span>
          <button
            type="button"
            aria-label="Acercar"
            :disabled="zoom >= ZOOM_MAX"
            @click="zoomIn"
            class="grid h-7 w-7 place-items-center rounded-md text-white/80 hover:bg-white/15 hover:text-white disabled:opacity-35 disabled:cursor-not-allowed transition-colors cursor-pointer"
          >
            <span class="h-4 w-4" v-html="ICONS.plus"></span>
          </button>
          <button
            type="button"
            aria-label="Restablecer zoom"
            :disabled="zoom === 1"
            @click="resetZoom"
            class="grid h-7 w-7 place-items-center rounded-md text-white/80 hover:bg-white/15 hover:text-white disabled:opacity-35 disabled:cursor-not-allowed transition-colors cursor-pointer"
          >
            <span class="h-4 w-4" v-html="ICONS.reset"></span>
          </button>
        </div>
      </template>

      <!-- Carga -->
      <div v-if="loading" class="flex items-start gap-10 overflow-hidden px-5 py-8">
        <div v-for="i in 3" :key="i" class="flex flex-col items-center gap-4">
          <div class="h-24 w-[200px] animate-pulse rounded-2xl bg-surface"></div>
          <div class="h-5 w-px animate-pulse bg-surface"></div>
          <div class="flex gap-6">
            <div class="h-20 w-[160px] animate-pulse rounded-2xl bg-surface"></div>
            <div class="h-20 w-[160px] animate-pulse rounded-2xl bg-surface"></div>
          </div>
        </div>
      </div>

      <!-- Sin departamentos -->
      <EmptyState
        v-else-if="!roots.length"
        :icon="ICONS.orgEmpty"
        title="Todavía no hay organigrama"
        message="Creá departamentos y asigná personal para visualizar la estructura del hotel."
      >
        <template #action>
          <router-link
            to="/panel/rrhh/empleados"
            class="inline-flex items-center rounded-full bg-navy px-5 py-2.5 text-sm font-bold text-white hover:bg-navy-light transition-colors"
          >
            Ir a Empleados
          </router-link>
        </template>
      </EmptyState>

      <!-- Árbol -->
      <div v-else class="overflow-x-auto px-5 py-8">
        <div
          class="flex min-w-max items-start gap-10"
          :style="{ zoom: String(zoom) }"
        >
          <OrgNode v-for="root in roots" :key="root.id" :node="root" />
        </div>
      </div>

      <!-- Leyenda -->
      <div v-if="!loading && roots.length" class="flex flex-wrap items-center gap-x-5 gap-y-2 border-t border-border bg-surface/60 px-5 py-3">
        <span class="text-[10px] font-bold uppercase tracking-wide text-text-muted">Referencia</span>
        <span class="flex items-center gap-1.5 text-[11px] font-semibold text-text-secondary">
          <span class="h-2.5 w-2.5 rounded-full bg-teal"></span> Empleado asignado
        </span>
        <span class="flex items-center gap-1.5 text-[11px] font-semibold text-text-secondary">
          <span class="h-2.5 w-5 rounded-full bg-cyan"></span> Departamento
        </span>
        <span class="flex items-center gap-1.5 text-[11px] font-semibold text-text-secondary">
          <span class="h-px w-5 bg-border"></span> Dependencia jerárquica
        </span>
      </div>
    </SectionCard>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, onMounted } from 'vue'
import { EmpleadosService, type OrgChartNode } from '@/services/Empleados.service'
import { useToast } from '@/composables/useToast'
import OrgNode from '@/components/features/OrgNode.vue'
import SectionCard from '@/components/ui/SectionCard.vue'
import EmptyState from '@/components/ui/EmptyState.vue'
import KpiHeroCard from '@/components/features/dashboard/KpiHeroCard.vue'

const toast = useToast()
const loading = ref(true)
const roots = ref<OrgChartNode[]>([])
const total = ref(0)

const ICONS: Record<string, string> = {
  back: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round" class="h-full w-full"><path d="M19 12H5M12 19l-7-7 7-7"/></svg>',
  plus: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round" class="h-full w-full"><path d="M12 5v14M5 12h14"/></svg>',
  minus: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round" class="h-full w-full"><path d="M5 12h14"/></svg>',
  reset: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round" class="h-full w-full"><path d="M3 12a9 9 0 1 0 3-6.7L3 8"/><path d="M3 3v5h5"/></svg>',
  orgEmpty: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" class="h-9 w-9"><rect x="9" y="2" width="6" height="5" rx="1"/><rect x="2" y="16" width="6" height="5" rx="1"/><rect x="16" y="16" width="6" height="5" rx="1"/><path d="M12 7v4M5 16v-3h14v3"/></svg>',
}

// ── Métricas derivadas del árbol (solo para KPIs de la vista) ──
function flatten(nodes: OrgChartNode[]): OrgChartNode[] {
  return nodes.flatMap(n => [n, ...flatten(n.children)])
}
function depthOf(nodes: OrgChartNode[]): number {
  if (!nodes.length) return 0
  return 1 + Math.max(...nodes.map(n => depthOf(n.children)))
}

const allDepartments = computed(() => flatten(roots.value))
const departmentCount = computed(() => allDepartments.value.length)
const staffedCount = computed(() => allDepartments.value.filter(d => d.employees.length > 0).length)
const emptyCount = computed(() => departmentCount.value - staffedCount.value)
const levelCount = computed(() => depthOf(roots.value))
const staffedShare = computed(() =>
  departmentCount.value ? Math.round((staffedCount.value / departmentCount.value) * 100) : 0
)
const chartSubtitle = computed(() =>
  loading.value
    ? 'Cargando estructura…'
    : `${departmentCount.value} departamento(s) · ${total.value} empleado(s)`
)

// ── Zoom del lienzo (solo presentación) ──
const ZOOM_MIN = 0.6
const ZOOM_MAX = 1.4
const ZOOM_STEP = 0.1
const zoom = ref(1)
const zoomLabel = computed(() => `${Math.round(zoom.value * 100)}%`)
function zoomIn() { zoom.value = Math.min(ZOOM_MAX, +(zoom.value + ZOOM_STEP).toFixed(2)) }
function zoomOut() { zoom.value = Math.max(ZOOM_MIN, +(zoom.value - ZOOM_STEP).toFixed(2)) }
function resetZoom() { zoom.value = 1 }

onMounted(async () => {
  try {
    const chart = await EmpleadosService.getOrgChart()
    roots.value = chart.departments
    total.value = chart.totalEmployees
  } catch { toast.error('No se pudo cargar el organigrama') }
  finally { loading.value = false }
})
</script>

<style scoped></style>
