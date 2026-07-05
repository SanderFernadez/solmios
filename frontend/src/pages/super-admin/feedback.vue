<script setup lang="ts">
import { ref, onMounted, computed } from 'vue'
import { FeedbackService } from '@/services/Feedback.service'
import type { FeedbackStatus } from '@/types'

interface FeedbackPin {
  id: string
  route: string
  x: number
  y: number
  comment: string
  priority: string
  category: string
  status: string
  screenshot?: string
  browser?: string
  viewportWidth?: number
  viewportHeight?: number
  userEmail?: string
  gitlabIssueUrl?: string
  createdAt: string
}

const pins = ref<FeedbackPin[]>([])
const loading = ref(true)
const selectedPin = ref<FeedbackPin | null>(null)
const filterStatus = ref<string>('all')
const filterRoute = ref<string>('')

const filteredPins = computed(() => {
  let result = pins.value
  if (filterStatus.value !== 'all') {
    result = result.filter(p => p.status === filterStatus.value)
  }
  if (filterRoute.value) {
    result = result.filter(p => p.route.includes(filterRoute.value))
  }
  return result.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())
})

const stats = computed(() => ({
  total: pins.value.length,
  open: pins.value.filter(p => p.status === 'open').length,
  inProgress: pins.value.filter(p => p.status === 'in_progress').length,
  resolved: pins.value.filter(p => p.status === 'resolved').length,
}))

async function loadPins() {
  loading.value = true
  try {
    const result = await FeedbackService.list()
    pins.value = Array.isArray(result) ? result : (result as any).data || []
  } catch {
    pins.value = []
  } finally {
    loading.value = false
  }
}

async function updateStatus(pin: FeedbackPin, status: string) {
  try {
    await FeedbackService.update(pin.id, { status: status as FeedbackStatus })
    pin.status = status
  } catch (e) {
    console.error('Error updating pin:', e)
  }
}

async function deletePin(pin: FeedbackPin) {
  if (!confirm('¿Eliminar este feedback?')) return
  try {
    await FeedbackService.remove(pin.id)
    pins.value = pins.value.filter(p => p.id !== pin.id)
    if (selectedPin.value?.id === pin.id) selectedPin.value = null
  } catch (e) {
    console.error('Error deleting pin:', e)
  }
}

function formatDate(date: string | Date): string {
  return new Date(date).toLocaleString('es-ES', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  })
}

function priorityColor(priority: string): string {
  switch (priority) {
    case 'high': return 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-300'
    case 'medium': return 'bg-yellow-100 text-yellow-700 dark:bg-yellow-900/30 dark:text-yellow-300'
    case 'low': return 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-300'
    default: return 'bg-gray-100 text-gray-700 dark:bg-gray-900/30 dark:text-gray-300'
  }
}

function statusColor(status: string): string {
  switch (status) {
    case 'open': return 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-300'
    case 'in_progress': return 'bg-yellow-100 text-yellow-700 dark:bg-yellow-900/30 dark:text-yellow-300'
    case 'resolved': return 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-300'
    case 'closed': return 'bg-gray-100 text-gray-700 dark:bg-gray-900/30 dark:text-gray-300'
    default: return 'bg-gray-100 text-gray-700 dark:bg-gray-900/30 dark:text-gray-300'
  }
}

onMounted(loadPins)
</script>

<template>
  <div class="space-y-6">
    <!-- Header -->
    <div class="flex items-center justify-between">
      <div>
        <h2 class="text-xl font-black text-navy dark:text-white">Feedback</h2>
        <p class="text-sm text-text-muted dark:text-gray-400 mt-0.5">Feedback de usuarios y reportes de bugs</p>
      </div>
      <button @click="loadPins" class="btn-ghost text-sm">
        🔄 Actualizar
      </button>
    </div>

    <!-- Stats -->
    <div class="grid grid-cols-4 gap-4">
      <div class="card p-4 text-center">
        <div class="text-2xl font-black text-navy dark:text-white">{{ stats.total }}</div>
        <div class="text-xs text-text-muted">Total</div>
      </div>
      <div class="card p-4 text-center">
        <div class="text-2xl font-black text-blue-500">{{ stats.open }}</div>
        <div class="text-xs text-text-muted">Abiertos</div>
      </div>
      <div class="card p-4 text-center">
        <div class="text-2xl font-black text-yellow-500">{{ stats.inProgress }}</div>
        <div class="text-xs text-text-muted">En progreso</div>
      </div>
      <div class="card p-4 text-center">
        <div class="text-2xl font-black text-green-500">{{ stats.resolved }}</div>
        <div class="text-xs text-text-muted">Resueltos</div>
      </div>
    </div>

    <!-- Filters -->
    <div class="flex gap-4">
      <select v-model="filterStatus" class="input w-40">
        <option value="all">Todos</option>
        <option value="open">Abiertos</option>
        <option value="in_progress">En progreso</option>
        <option value="resolved">Resueltos</option>
        <option value="closed">Cerrados</option>
      </select>
      <input
        v-model="filterRoute"
        type="text"
        placeholder="Filtrar por ruta..."
        class="input flex-1"
      />
    </div>

    <!-- Loading -->
    <div v-if="loading" class="space-y-4">
      <div v-for="i in 3" :key="i" class="card p-4 animate-pulse">
        <div class="h-4 w-3/4 bg-surface rounded mb-2"></div>
        <div class="h-3 w-1/2 bg-surface rounded"></div>
      </div>
    </div>

    <!-- Empty state -->
    <div v-else-if="filteredPins.length === 0" class="card p-12 text-center">
      <div class="text-4xl mb-4">📝</div>
      <h3 class="text-lg font-bold text-navy dark:text-white">Sin feedbacks</h3>
      <p class="text-sm text-text-muted mt-1">Los feedbacks de los usuarios aparecerán aquí</p>
    </div>

    <!-- Feedback list -->
    <div v-else class="space-y-3">
      <div
        v-for="pin in filteredPins"
        :key="pin.id"
        class="card p-4 cursor-pointer hover:shadow-md transition-all"
        :class="{ 'ring-2 ring-cyan': selectedPin?.id === pin.id }"
        @click="selectedPin = selectedPin?.id === pin.id ? null : pin"
      >
        <div class="flex items-start justify-between gap-4">
          <div class="flex-1 min-w-0">
            <div class="flex items-center gap-2 mb-1">
              <span :class="['text-[10px] font-bold px-2 py-0.5 rounded-full uppercase', priorityColor(pin.priority)]">
                {{ pin.priority }}
              </span>
              <span :class="['text-[10px] font-bold px-2 py-0.5 rounded-full uppercase', statusColor(pin.status)]">
                {{ pin.status }}
              </span>
              <span class="text-[10px] font-bold px-2 py-0.5 rounded-full bg-purple-100 text-purple-700 dark:bg-purple-900/30 dark:text-purple-300">
                {{ pin.category }}
              </span>
            </div>
            <p class="text-sm font-medium text-navy dark:text-white truncate">{{ pin.comment }}</p>
            <div class="flex items-center gap-4 mt-2 text-xs text-text-muted">
              <span>📍 {{ pin.route }}</span>
              <span>📌 ({{ pin.x }}, {{ pin.y }})</span>
              <span>👤 {{ pin.userEmail || 'Anónimo' }}</span>
              <span>🕐 {{ formatDate(pin.createdAt) }}</span>
            </div>
          </div>

          <div class="flex items-center gap-2">
            <a
              v-if="pin.gitlabIssueUrl"
              :href="pin.gitlabIssueUrl"
              target="_blank"
              class="text-xs text-blue-500 hover:underline"
              @click.stop
            >
              GitLab #{{ pin.gitlabIssueUrl.split('/').pop() }}
            </a>
            <select
              :value="pin.status"
              @change="updateStatus(pin, ($event.target as HTMLSelectElement).value)"
              @click.stop
              class="input w-32 text-xs"
            >
              <option value="open">Abierto</option>
              <option value="in_progress">En progreso</option>
              <option value="resolved">Resuelto</option>
              <option value="closed">Cerrado</option>
            </select>
            <button
              @click.stop="deletePin(pin)"
              class="text-red-500 hover:text-red-700 text-xs px-2 py-1 rounded"
            >
              🗑️
            </button>
          </div>
        </div>

        <!-- Screenshot preview (expanded) -->
        <div v-if="selectedPin?.id === pin.id && pin.screenshot" class="mt-4">
          <div class="rounded-xl overflow-hidden border border-border dark:border-white/10">
            <img
              :src="pin.screenshot"
              :alt="`Screenshot de feedback en ${pin.route}`"
              class="w-full max-h-96 object-contain bg-surface dark:bg-navy"
            />
          </div>
          <div class="mt-2 flex items-center gap-4 text-xs text-text-muted">
            <span v-if="pin.browser">🌐 {{ pin.browser }}</span>
            <span v-if="pin.viewportWidth">📐 {{ pin.viewportWidth }}×{{ pin.viewportHeight }}</span>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>

<style scoped>
.input {
  height: 36px;
  padding: 0 12px;
  border: 1px solid var(--color-border);
  border-radius: 8px;
  font-size: 13px;
  color: var(--color-text);
  background: white;
  transition: all 0.15s ease;
}
.input:focus {
  outline: none;
  border-color: var(--color-cyan);
  box-shadow: 0 0 0 3px rgba(0, 180, 216, 0.15);
}
.btn-ghost {
  padding: 8px 16px;
  border: 1px solid var(--color-border);
  border-radius: 8px;
  font-size: 13px;
  font-weight: 600;
  color: var(--color-text);
  background: white;
  cursor: pointer;
  transition: all 0.15s ease;
}
.btn-ghost:hover {
  border-color: var(--color-cyan);
  color: var(--color-cyan);
}
</style>
