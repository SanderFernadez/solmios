<template>
  <div>
    <!-- Header -->
    <div class="flex flex-wrap items-center justify-between gap-3 mb-6">
      <div class="min-w-0">
        <h2 class="text-xl font-black text-navy">Cola de Emails</h2>
        <p class="text-xs text-text-muted mt-1">Emails encolados, enviados y fallidos. Reenviá los que fallaron.</p>
      </div>
      <div class="flex items-center gap-2">
        <div class="flex items-center gap-1 bg-white border border-border rounded-full p-1">
          <button
            v-for="opt in STATUS_FILTERS"
            :key="opt.value ?? 'all'"
            @click="setFilter(opt.value)"
            class="px-3 py-1.5 rounded-full text-xs font-bold transition-colors cursor-pointer"
            :class="filter === opt.value ? 'bg-navy text-white' : 'text-text-secondary hover:text-navy'"
          >
            {{ opt.label }}
          </button>
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
    </div>

    <!-- Feedback -->
    <div v-if="toast" class="mb-4 rounded-2xl border px-4 py-3 text-sm font-semibold" :class="toast.ok ? 'border-teal/30 bg-teal/10 text-teal' : 'border-coral/30 bg-coral/10 text-coral'">
      {{ toast.text }}
    </div>

    <!-- Card -->
    <div class="rounded-[20px] border border-border bg-white shadow-(--shadow-card) overflow-hidden">
      <!-- Loading -->
      <div v-if="loading && rows.length === 0" class="flex items-center justify-center py-16 text-text-muted text-sm gap-2">
        <span class="w-4 h-4 animate-spin" v-html="ICON_REFRESH"></span>
        Cargando...
      </div>

      <!-- Empty -->
      <div v-else-if="rows.length === 0" class="flex flex-col items-center justify-center py-16 px-6 text-center">
        <span class="w-10 h-10 mb-3 text-text-muted opacity-40" v-html="ICON_MAIL"></span>
        <p class="text-sm font-bold text-navy">No hay emails en la cola</p>
        <p class="text-xs text-text-muted mt-1">Cuando el sistema envíe correos, los vas a ver acá.</p>
      </div>

      <!-- Tabla -->
      <div v-else class="overflow-x-auto">
        <table class="w-full text-sm min-w-[820px]">
          <thead>
            <tr class="text-left text-[11px] uppercase tracking-wide text-text-muted border-b border-border">
              <th class="px-4 py-3 font-bold">Destinatario</th>
              <th class="px-4 py-3 font-bold">Asunto</th>
              <th class="px-4 py-3 font-bold">Estado</th>
              <th class="px-4 py-3 font-bold text-center">Intentos</th>
              <th class="px-4 py-3 font-bold">Último error</th>
              <th class="px-4 py-3 font-bold">Fecha</th>
              <th class="px-4 py-3 font-bold text-right">Acción</th>
            </tr>
          </thead>
          <tbody>
            <tr v-for="row in rows" :key="row.id" class="border-b border-border last:border-0 hover:bg-surface/50">
              <td class="px-4 py-3 font-semibold text-navy whitespace-nowrap">{{ row.recipient }}</td>
              <td class="px-4 py-3 text-text-secondary max-w-[220px] truncate" :title="row.subject">{{ row.subject }}</td>
              <td class="px-4 py-3">
                <span class="inline-flex items-center rounded-full px-2.5 py-1 text-[10px] font-extrabold uppercase" :class="emailStatusMeta(row.status).class">
                  {{ emailStatusMeta(row.status).label }}
                </span>
              </td>
              <td class="px-4 py-3 text-center text-text-secondary tabular-nums">{{ row.attempts }} / {{ row.maxAttempts }}</td>
              <td class="px-4 py-3 max-w-[240px]">
                <span v-if="row.lastError" class="text-xs text-coral truncate block" :title="row.lastError">{{ row.lastError }}</span>
                <span v-else class="text-xs text-text-muted">—</span>
              </td>
              <td class="px-4 py-3 text-text-muted whitespace-nowrap text-xs">{{ formatDate(row.updatedAt || row.createdAt) }}</td>
              <td class="px-4 py-3 text-right">
                <button
                  @click="requeue(row)"
                  :disabled="requeuing === row.id || row.status === 'processing'"
                  class="inline-flex items-center gap-1.5 bg-navy text-white font-bold text-xs px-3 py-1.5 rounded-full hover:bg-navy/90 transition-all cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  <span class="w-3.5 h-3.5" :class="requeuing === row.id ? 'animate-spin' : ''" v-html="requeuing === row.id ? ICON_REFRESH : ICON_SEND"></span>
                  Reenviar
                </button>
              </td>
            </tr>
          </tbody>
        </table>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, onMounted } from 'vue'
import { EmailQueueService, emailStatusMeta, type EmailQueueItem, type EmailQueueStatus } from '@/services/EmailQueue.service'

const ICON_REFRESH = '<svg viewBox="0 0 24 24" class="w-full h-full" fill="none" stroke="currentColor" stroke-width="1.8"><path stroke-linecap="round" stroke-linejoin="round" d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15"/></svg>'
const ICON_SEND = '<svg viewBox="0 0 24 24" class="w-full h-full" fill="none" stroke="currentColor" stroke-width="1.8"><path stroke-linecap="round" stroke-linejoin="round" d="m22 2-7 20-4-9-9-4Z"/><path stroke-linecap="round" stroke-linejoin="round" d="M22 2 11 13"/></svg>'
const ICON_MAIL = '<svg viewBox="0 0 24 24" class="w-full h-full" fill="none" stroke="currentColor" stroke-width="1.6"><rect width="20" height="16" x="2" y="4" rx="2"/><path stroke-linecap="round" stroke-linejoin="round" d="m22 7-8.97 5.7a1.94 1.94 0 0 1-2.06 0L2 7"/></svg>'

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

const TOAST_TIMEOUT_MS = 4000
function showToast(ok: boolean, text: string) {
  toast.value = { ok, text }
  setTimeout(() => { toast.value = null }, TOAST_TIMEOUT_MS)
}

function formatDate(iso?: string): string {
  if (!iso) return '—'
  const d = new Date(iso)
  if (Number.isNaN(d.getTime())) return '—'
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
