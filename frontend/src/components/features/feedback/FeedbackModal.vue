<script setup lang="ts">
import { ref } from 'vue'
import type { FeedbackPriority, FeedbackCategory } from '@/types'
import { useFeedbackStore } from '@/stores/feedback.store'
import AppModal from '@/components/ui/AppModal.vue'

const store = useFeedbackStore()

const comment = ref('')
const priority = ref<FeedbackPriority>('medium')
const category = ref<FeedbackCategory>('UI')

function reset() {
  comment.value = ''
  priority.value = 'medium'
  category.value = 'UI'
}

async function handleSave() {
  if (!comment.value.trim()) return
  await store.savePin({
    comment: comment.value.trim(),
    priority: priority.value,
    category: category.value,
  })
  if (!store.lastIssueUrl) reset()
}

function handleClose() {
  store.closeModal()
  reset()
}
</script>

<template>
  <AppModal :open="store.isModalOpen" size="md" @close="handleClose">
    <template #header>
      <div class="flex items-center justify-between gap-3 w-full min-w-0">
        <div class="min-w-0">
          <h3 class="text-base sm:text-lg font-black text-white truncate">Nuevo Feedback</h3>
          <p class="text-[11px] text-white/60 mt-0.5 truncate">
            {{ store.pendingCoordinates ? `Pin en (${Math.round(store.pendingCoordinates.x)}, ${Math.round(store.pendingCoordinates.y)})` : '' }}
          </p>
        </div>
        <div class="w-8 h-8 rounded-full bg-coral text-white flex items-center justify-center text-sm font-black shadow-sm shrink-0">
          {{ store.routePins.length + 1 }}
        </div>
      </div>
    </template>

    <div class="space-y-4">
            <div v-if="store.lastIssueUrl" class="bg-success/10 border border-success/20 rounded-xl p-3">
              <div class="flex items-center gap-2">
                <span class="text-success text-lg">✓</span>
                <div class="flex-1 min-w-0">
                  <p class="text-xs font-bold text-navy dark:text-white">Issue creado en GitHub</p>
                  <a
                    :href="store.lastIssueUrl"
                    target="_blank"
                    class="text-[11px] text-blue underline truncate block"
                  >{{ store.lastIssueUrl }}</a>
                </div>
              </div>
            </div>

            <div v-if="store.lastError" class="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-xl p-3">
              <div class="flex items-center gap-2">
                <span class="text-red-500 text-lg">✗</span>
                <div class="flex-1 min-w-0">
                  <p class="text-xs font-bold text-red-700 dark:text-red-300">Error al crear issue</p>
                  <p class="text-[11px] text-red-600 dark:text-red-400">{{ store.lastError }}</p>
                </div>
              </div>
            </div>

            <div v-if="store.pendingScreenshot && !store.lastIssueUrl" class="relative rounded-xl overflow-hidden border border-border dark:border-white/10 bg-surface dark:bg-navy">
              <img
                :src="store.pendingScreenshot"
                alt="Screenshot"
                class="w-full h-36 object-cover opacity-80"
              />
              <div class="absolute inset-0 flex items-center justify-center">
                <span class="bg-navy/70 text-white text-[10px] font-bold px-2 py-1 rounded-lg">Screenshot capturado</span>
              </div>
            </div>

            <div v-else-if="!store.lastIssueUrl && !store.pendingScreenshot" class="rounded-xl border border-border dark:border-white/10 bg-surface dark:bg-navy p-3 text-center">
              <p class="text-[11px] text-text-muted dark:text-gray-500">Esperando permiso para capturar pantalla...</p>
            </div>

            <div v-if="!store.lastIssueUrl">
              <div>
                <label class="block text-[11px] font-bold text-text-secondary dark:text-gray-400 uppercase tracking-wide mb-1.5">Comentario</label>
                <textarea
                  v-model="comment"
                  placeholder="Describí el issue o sugerencia..."
                  class="input !h-24 !py-3 resize-none dark:bg-navy dark:text-white dark:border-white/10"
                />
              </div>

              <div class="grid grid-cols-2 gap-4">
                <div>
                  <label class="block text-[11px] font-bold text-text-secondary dark:text-gray-400 uppercase tracking-wide mb-1.5">Prioridad</label>
                  <select
                    v-model="priority"
                    class="input appearance-none cursor-pointer dark:bg-navy dark:text-white dark:border-white/10"
                  >
                    <option value="low">Baja</option>
                    <option value="medium">Media</option>
                    <option value="high">Alta</option>
                  </select>
                </div>
                <div>
                  <label class="block text-[11px] font-bold text-text-secondary dark:text-gray-400 uppercase tracking-wide mb-1.5">Categoría</label>
                  <select
                    v-model="category"
                    class="input appearance-none cursor-pointer dark:bg-navy dark:text-white dark:border-white/10"
                  >
                    <option value="UI">UI</option>
                    <option value="Bug">Bug</option>
                    <option value="Improvement">Mejora</option>
                  </select>
                </div>
              </div>
            </div>
    </div>

    <template #footer>
      <button
        v-if="!store.lastIssueUrl"
        class="btn-ghost dark:text-gray-400 dark:border-white/10 dark:hover:text-white"
        @click="handleClose"
      >
        Cancelar
      </button>
      <button
        v-if="!store.lastIssueUrl"
        class="btn-primary flex items-center gap-2"
        :disabled="!comment.trim() || store.loading"
        :class="{ 'opacity-50 cursor-not-allowed': !comment.trim() || store.loading }"
        @click="handleSave"
      >
        <svg v-if="store.loading" class="animate-spin w-4 h-4" viewBox="0 0 24 24" fill="none">
          <circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4" />
          <path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
        </svg>
        <span v-else>Guardar &amp; crear Issue</span>
      </button>
      <button
        v-else
        class="btn-primary"
        @click="handleClose"
      >
        Cerrar
      </button>
    </template>
  </AppModal>
</template>

<style scoped>
.input {
  width: 100%;
  height: 40px;
  padding: 0 14px;
  border: 1px solid var(--color-border);
  border-radius: 10px;
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
.input::placeholder {
  color: var(--color-text-muted);
}
</style>
