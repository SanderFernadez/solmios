<template>
  <div>
    <!-- Header -->
    <div class="flex flex-wrap items-center justify-between gap-3 mb-6">
      <div class="min-w-0">
        <h2 class="text-xl font-black text-navy">Cola de Emails</h2>
        <p class="text-xs text-text-muted mt-1">Emails encolados, enviados y fallidos. Reenviá los que fallaron.</p>
      </div>
      <button
        @click="load"
        :disabled="loading"
        class="flex items-center gap-1.5 bg-white text-text-secondary border border-border font-bold text-sm px-4 py-2 rounded-full hover:border-navy/30 hover:text-navy transition-all cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed"
      >
        <span class="w-4 h-4 shrink-0" :class="loading ? 'animate-spin' : ''" v-html="ICON_REFRESH"></span>
        Refrescar
      </button>
    </div>

    <!-- Feedback -->
    <div v-if="toast" class="mb-4 rounded-2xl border px-4 py-3 text-sm font-semibold" :class="toast.ok ? 'border-teal/30 bg-teal/10 text-teal' : 'border-coral/30 bg-coral/10 text-coral'">
      {{ toast.text }}
    </div>

    <!-- KPIs — se calculan sobre las filas traídas, o sea sobre el filtro activo.
         El filtro se aplica en el servidor (EmailQueueService.list), así que con
         "Fallidos" seleccionado el resto de las cifras es 0 por definición. -->
    <div class="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-4 mb-6">
      <KpiHeroCard label="En cola" :value="stats.total" icon="bookings" accent="blue"
        :unit="filterLabel" />
      <KpiHeroCard label="Pendientes" :value="stats.pending" icon="bed" accent="amber"
        :unit="stats.processing ? `${stats.processing} procesándose ahora` : 'Esperando al worker'" />
      <KpiHeroCard label="Enviados" :value="stats.sent" icon="checkin" accent="teal"
        unit="Entregados al proveedor" />
      <KpiHeroCard label="Fallidos" :value="stats.failed" icon="checkout" accent="rose"
        :unit="`${stats.attempts} intento(s) acumulado(s)`" />
    </div>

    <!-- Listado -->
    <SectionCard title="Cola de envíos" :subtitle="`${rows.length} email(s) · ${filterLabel}`" body-class="p-0">
      <template #actions>
        <div class="flex items-center gap-1 rounded-full border border-white/15 bg-white/10 p-1">
          <button
            v-for="opt in STATUS_FILTERS"
            :key="opt.value ?? 'all'"
            @click="setFilter(opt.value)"
            class="px-3 py-1.5 rounded-full text-xs font-bold transition-colors cursor-pointer"
            :class="filter === opt.value ? 'bg-white text-navy' : 'text-white/70 hover:text-white'"
          >
            {{ opt.label }}
          </button>
        </div>
      </template>

      <!-- Skeleton de carga -->
      <div v-if="loading && rows.length === 0" class="divide-y divide-border">
        <div v-for="n in 6" :key="n" class="flex items-center gap-4 px-4 py-4">
          <div class="h-3.5 w-48 animate-pulse rounded bg-surface"></div>
          <div class="h-3.5 flex-1 animate-pulse rounded bg-surface"></div>
          <div class="h-5 w-20 animate-pulse rounded-full bg-surface"></div>
          <div class="h-3.5 w-24 animate-pulse rounded bg-surface"></div>
          <div class="h-8 w-8 animate-pulse rounded-lg bg-surface"></div>
        </div>
      </div>

      <!-- Vacío: sin datos vs. filtro sin resultados -->
      <EmptyState
        v-else-if="rows.length === 0"
        :icon="ICON_MAIL"
        :title="filter ? 'Sin resultados' : 'No hay emails en la cola'"
        :message="filter
          ? 'Ningún email coincide con este estado. Probá con otro filtro.'
          : 'Cuando el sistema envíe correos, los vas a ver acá.'"
      >
        <template #action>
          <button v-if="filter" @click="setFilter(undefined)"
            class="px-5 py-2.5 rounded-full border border-border text-sm font-bold text-navy hover:bg-surface transition-colors cursor-pointer">
            Ver todos
          </button>
        </template>
      </EmptyState>

      <!-- Tabla -->
      <div v-else class="overflow-x-auto">
        <table class="w-full min-w-[900px] tbl-head text-sm">
          <thead>
            <tr>
              <th class="text-left px-4 py-3 text-[10px]">Destinatario</th>
              <th class="text-left px-4 py-3 text-[10px] hidden lg:table-cell">Asunto</th>
              <th class="text-left px-4 py-3 text-[10px]">Estado</th>
              <th class="text-right px-4 py-3 text-[10px]">Intentos</th>
              <th class="text-left px-4 py-3 text-[10px] hidden xl:table-cell">Último error</th>
              <th class="text-right px-4 py-3 text-[10px] hidden lg:table-cell">Fecha</th>
              <th class="text-right px-4 py-3 text-[10px]">Acciones</th>
            </tr>
          </thead>
          <tbody>
            <tr v-for="row in rows" :key="row.id" class="border-b border-border last:border-0 hover:bg-surface/60 transition-colors">
              <td class="px-4 py-3">
                <div class="flex items-center gap-3 min-w-0">
                  <div class="grid h-9 w-9 shrink-0 place-items-center rounded-full bg-navy/5 text-[11px] font-black text-navy">
                    {{ initialsOf(row.recipient) }}
                  </div>
                  <div class="min-w-0">
                    <div class="truncate text-sm font-bold text-navy">{{ row.recipient }}</div>
                    <!-- En <lg el asunto y la fecha suben acá (sus columnas están ocultas) -->
                    <div v-if="row.subject" class="truncate text-[11px] text-text-muted lg:hidden">{{ row.subject }}</div>
                    <div v-if="formatDate(row.updatedAt || row.createdAt)" class="text-[11px] text-text-muted tabular-nums lg:hidden">
                      {{ formatDate(row.updatedAt || row.createdAt) }}
                    </div>
                  </div>
                </div>
              </td>
              <td class="px-4 py-3 hidden lg:table-cell">
                <div v-if="row.subject" class="max-w-[260px] truncate text-text-secondary" :title="row.subject">{{ row.subject }}</div>
                <span v-else class="text-text-muted">Sin asunto</span>
              </td>
              <td class="px-4 py-3">
                <span class="inline-flex items-center rounded-full px-2.5 py-1 text-[10px] font-extrabold uppercase tracking-wide" :class="emailStatusMeta(row.status).class">
                  {{ emailStatusMeta(row.status).label }}
                </span>
              </td>
              <td class="px-4 py-3 text-right">
                <span class="text-sm font-bold tabular-nums" :class="row.attempts >= row.maxAttempts ? 'text-coral' : 'text-navy'">
                  {{ row.attempts }}
                </span>
                <span class="text-[11px] text-text-muted tabular-nums"> / {{ row.maxAttempts }}</span>
              </td>
              <td class="px-4 py-3 hidden xl:table-cell">
                <span v-if="row.lastError" class="block max-w-[240px] truncate text-xs text-coral" :title="row.lastError">{{ row.lastError }}</span>
                <span v-else class="text-xs text-text-muted">Sin errores</span>
              </td>
              <td class="px-4 py-3 text-right text-xs text-text-muted tabular-nums whitespace-nowrap hidden lg:table-cell">
                {{ formatDate(row.updatedAt || row.createdAt) || 'Sin fecha' }}
              </td>
              <td class="px-4 py-3 text-right">
                <div class="flex items-center justify-end">
                  <button
                    @click="requeue(row)"
                    :disabled="requeuing === row.id || row.status === 'processing'"
                    :title="row.status === 'processing' ? 'Se está procesando' : 'Reenviar email'"
                    class="grid h-8 w-8 place-items-center rounded-lg text-text-muted hover:bg-navy/10 hover:text-navy transition-colors cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed disabled:hover:bg-transparent"
                  >
                    <span class="h-4 w-4" :class="requeuing === row.id ? 'animate-spin' : ''" v-html="requeuing === row.id ? ICON_REFRESH : ICON_SEND"></span>
                  </button>
                </div>
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
import { EmailQueueService, emailStatusMeta, type EmailQueueItem, type EmailQueueStatus } from '@/services/EmailQueue.service'
import KpiHeroCard from '@/components/features/dashboard/KpiHeroCard.vue'
import SectionCard from '@/components/ui/SectionCard.vue'
import EmptyState from '@/components/ui/EmptyState.vue'

const ICON_REFRESH = '<svg viewBox="0 0 24 24" class="w-full h-full" fill="none" stroke="currentColor" stroke-width="1.8"><path stroke-linecap="round" stroke-linejoin="round" d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15"/></svg>'
const ICON_SEND = '<svg viewBox="0 0 24 24" class="w-full h-full" fill="none" stroke="currentColor" stroke-width="1.8"><path stroke-linecap="round" stroke-linejoin="round" d="m22 2-7 20-4-9-9-4Z"/><path stroke-linecap="round" stroke-linejoin="round" d="M22 2 11 13"/></svg>'
const ICON_MAIL = '<svg viewBox="0 0 24 24" class="h-8 w-8" fill="none" stroke="currentColor" stroke-width="1.6"><rect width="20" height="16" x="2" y="4" rx="2"/><path stroke-linecap="round" stroke-linejoin="round" d="m22 7-8.97 5.7a1.94 1.94 0 0 1-2.06 0L2 7"/></svg>'

const STATUS_FILTERS: { label: string; value?: EmailQueueStatus }[] = [
  { label: 'Todos', value: undefined },
  { label: 'Pendientes', value: 'pending' },
  { label: 'Fallidos', value: 'failed' },
  { label: 'Enviados', value: 'sent' },
]

const rows = ref<EmailQueueItem[]>([])
const loading = ref(false)
const requeuing = ref<string | null>(null)
const filter = ref<EmailQueueStatus | undefined>(undefined)
const toast = ref<{ ok: boolean; text: string } | null>(null)

const filterLabel = computed(() => STATUS_FILTERS.find(o => o.value === filter.value)?.label ?? 'Todos')

const stats = computed(() => {
  const list = rows.value
  return {
    total: list.length,
    pending: list.filter(r => r.status === 'pending').length,
    processing: list.filter(r => r.status === 'processing').length,
    sent: list.filter(r => r.status === 'sent').length,
    failed: list.filter(r => r.status === 'failed').length,
    attempts: list.reduce((acc, r) => acc + (r.attempts || 0), 0),
  }
})

function initialsOf(recipient: string): string {
  const local = (recipient || '').split('@')[0] || ''
  const parts = local.split(/[._-]+/).filter(Boolean)
  const raw = parts.length >= 2 ? `${parts[0][0]}${parts[1][0]}` : local.slice(0, 2)
  return raw.toUpperCase() || '@'
}

const TOAST_TIMEOUT_MS = 4000
function showToast(ok: boolean, text: string) {
  toast.value = { ok, text }
  setTimeout(() => { toast.value = null }, TOAST_TIMEOUT_MS)
}

function formatDate(iso?: string): string {
  if (!iso) return ''
  const d = new Date(iso)
  if (Number.isNaN(d.getTime())) return ''
  return `${d.getDate()}/${d.getMonth() + 1}/${d.getFullYear()} ${d.getHours()}:${String(d.getMinutes()).padStart(2, '0')}`
}

async function load() {
  loading.value = true
  try {
    const page = await EmailQueueService.list({ status: filter.value, limit: 100 })
    rows.value = page.data ?? []
  } catch {
    rows.value = []
    showToast(false, 'No se pudo cargar la cola de emails.')
  } finally {
    loading.value = false
  }
}

function setFilter(value?: EmailQueueStatus) {
  filter.value = value
  load()
}

async function requeue(row: EmailQueueItem) {
  if (requeuing.value) return
  requeuing.value = row.id
  try {
    await EmailQueueService.requeue(row.id)
    showToast(true, `Email a ${row.recipient} reencolado. El sistema lo reintentará en breve.`)
    await load()
  } catch {
    showToast(false, 'No se pudo reencolar el email.')
  } finally {
    requeuing.value = null
  }
}

onMounted(load)
</script>

<style scoped>
.tabular-nums {
  font-variant-numeric: tabular-nums;
}
</style>
