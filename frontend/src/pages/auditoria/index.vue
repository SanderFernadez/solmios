<template>
  <div>
    <div class="mb-4">
      <h2 class="text-xl font-black text-navy">Auditoría</h2>
      <p class="text-xs text-text-muted mt-0.5">Bitácora de acciones sensibles de tu hotel (borrados, cambios de configuración, etc.)</p>
    </div>

    <SectionCard
      title="Registro de actividad"
      :subtitle="total ? `${total} evento(s)` : undefined"
      body-class="p-0"
    >
      <div v-if="loading" class="space-y-2 p-4">
        <div v-for="n in 6" :key="n" class="h-12 animate-pulse rounded-xl bg-surface"></div>
      </div>

      <EmptyState
        v-else-if="loadError"
        title="No se pudo cargar la auditoría"
        message="Hubo un problema consultando el registro. Probá de nuevo."
      >
        <template #action>
          <button class="rounded-full bg-navy px-5 py-2 text-sm font-bold text-white hover:shadow-lg cursor-pointer" @click="reload">
            Reintentar
          </button>
        </template>
      </EmptyState>

      <EmptyState
        v-else-if="rows.length === 0"
        title="Sin eventos registrados"
        message="Todavía no hay acciones sensibles registradas en tu hotel."
      />

      <div v-else class="overflow-x-auto">
        <table class="w-full min-w-[720px] tbl-head">
          <thead>
            <tr>
              <th class="px-4 py-3 text-left">Fecha</th>
              <th class="px-4 py-3 text-left">Usuario</th>
              <th class="px-4 py-3 text-left">Acción</th>
              <th class="px-4 py-3 text-left">Entidad</th>
              <th class="px-4 py-3 text-left">Detalle</th>
            </tr>
          </thead>
          <tbody>
            <tr v-for="row in rows" :key="row.id" class="border-t border-border hover:bg-surface/50">
              <td class="px-4 py-3 whitespace-nowrap text-xs text-text-muted">{{ formatDate(row.createdAt) }}</td>
              <td class="px-4 py-3 text-sm font-bold text-navy">{{ row.userName || 'Sistema' }}</td>
              <td class="px-4 py-3">
                <span class="rounded-full bg-navy/5 px-2.5 py-1 text-[11px] font-bold text-navy">{{ row.action }}</span>
              </td>
              <td class="px-4 py-3 text-xs text-text-secondary">{{ row.entity || '—' }}</td>
              <td class="px-4 py-3 text-xs text-text-secondary max-w-[320px] truncate">{{ row.detail || '—' }}</td>
            </tr>
          </tbody>
        </table>
      </div>

      <div v-if="!loading && !loadError && rows.length > 0" class="flex items-center justify-between border-t border-border p-4">
        <span class="text-xs text-text-muted">
          {{ (page - 1) * LIMIT + 1 }}–{{ (page - 1) * LIMIT + rows.length }} de {{ total }}
        </span>
        <div class="flex gap-2">
          <button
            class="rounded-full border border-border px-4 py-1.5 text-xs font-bold text-text-secondary disabled:opacity-40 cursor-pointer disabled:cursor-not-allowed"
            :disabled="page <= 1"
            @click="page--"
          >Anterior</button>
          <button
            class="rounded-full border border-border px-4 py-1.5 text-xs font-bold text-text-secondary disabled:opacity-40 cursor-pointer disabled:cursor-not-allowed"
            :disabled="page * LIMIT >= total"
            @click="page++"
          >Siguiente</button>
        </div>
      </div>
    </SectionCard>
  </div>
</template>

<script setup lang="ts">
import { ref, watch, onMounted } from 'vue'
import SectionCard from '@/components/ui/SectionCard.vue'
import EmptyState from '@/components/ui/EmptyState.vue'
import { AuditLogService } from '@/services/AuditLog.service'
import type { AuditLogRecord } from '@/types'

const LIMIT = 20

const rows = ref<AuditLogRecord[]>([])
const total = ref(0)
const page = ref(1)
const loading = ref(true)
const loadError = ref(false)

async function reload() {
  loading.value = true
  loadError.value = false
  try {
    // Sin hotelId: el backend lo resuelve del token (resolveTenant) — un hotel_admin SOLO
    // puede ver el suyo, sin importar qué se mande acá (mismo criterio que el resto del panel).
    // Sin `search`: el backend NO filtra por texto (AuditlogQuery.search existe en el tipo pero
    // el service nunca lo usa — RepositoryAdapter no soporta LIKE, mismo límite que DT-07).
    const res = await AuditLogService.list({ page: page.value, limit: LIMIT })
    rows.value = res.data
    total.value = res.total
  } catch {
    loadError.value = true
  } finally {
    loading.value = false
  }
}

function formatDate(iso: string): string {
  const d = new Date(iso)
  if (isNaN(d.getTime())) return iso
  return d.toLocaleString('es', { day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' })
}

watch(page, reload)
onMounted(reload)
</script>

<style scoped>
</style>
