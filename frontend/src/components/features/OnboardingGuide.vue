<template>
  <!-- Primeros pasos. Un hotel recién creado entra a un panel con todo en cero
       y ninguna pista de por dónde empezar; esta guía es esa pista. Desaparece
       sola cuando lo obligatorio ya está hecho. -->
  <div v-if="show" class="rounded-[20px] border-2 border-navy bg-white overflow-hidden mb-6">
    <div class="bg-navy px-5 py-4 flex items-center justify-between gap-3">
      <div class="min-w-0">
        <h3 class="text-base font-black text-white">Configurá tu hotel</h3>
        <p class="text-[11px] text-white/60 mt-0.5">
          {{ status!.doneCount }} de {{ status!.totalCount }} pasos · unos minutos y ya podés operar
        </p>
      </div>
      <div class="flex items-center gap-2 shrink-0">
        <div class="w-24 h-1.5 rounded-full bg-white/15 overflow-hidden hidden sm:block">
          <div class="h-full bg-cyan transition-all duration-500" :style="{ width: progress + '%' }"></div>
        </div>
        <button
          @click="dismissed = true"
          class="text-white/50 hover:text-white text-lg leading-none cursor-pointer px-1"
          aria-label="Ocultar guía"
        >✕</button>
      </div>
    </div>

    <div class="divide-y divide-border">
      <div
        v-for="(s, i) in status!.steps" :key="s.key"
        class="flex items-center gap-3 px-5 py-3.5"
        :class="s.done ? 'bg-surface/60' : ''"
      >
        <span
          class="w-6 h-6 rounded-full grid place-items-center shrink-0 text-[11px] font-black"
          :class="s.done ? 'bg-teal text-white' : 'border-2 border-border text-text-muted'"
        >
          <svg v-if="s.done" class="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24" stroke-width="4"><path stroke-linecap="round" stroke-linejoin="round" d="M5 13l4 4L19 7" /></svg>
          <template v-else>{{ i + 1 }}</template>
        </span>

        <div class="min-w-0 flex-1">
          <div class="flex items-center gap-2 flex-wrap">
            <span class="text-sm font-bold" :class="s.done ? 'text-text-muted line-through' : 'text-navy'">{{ s.title }}</span>
            <span v-if="s.count" class="text-[10px] font-bold text-teal bg-teal/10 px-1.5 py-0.5 rounded-full">{{ s.count }}</span>
            <span v-if="!s.required && !s.done" class="text-[10px] text-text-muted">opcional</span>
          </div>
          <p v-if="!s.done" class="text-[11px] text-text-muted mt-0.5">{{ s.description }}</p>
        </div>

        <router-link
          v-if="!s.done"
          :to="s.route"
          class="shrink-0 px-3.5 py-1.5 rounded-full text-[11px] font-bold transition-colors"
          :class="s.required ? 'bg-navy text-white hover:bg-navy-light' : 'border border-border text-text-secondary hover:border-navy/30'"
        >Empezar</router-link>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, onMounted } from 'vue'
import { OnboardingService, type OnboardingStatus } from '@/services/Onboarding.service'

const status = ref<OnboardingStatus | null>(null)
const dismissed = ref(false)

const show = computed(() => !dismissed.value && status.value !== null && !status.value.completed)
const progress = computed(() =>
  status.value ? Math.round((status.value.doneCount / status.value.totalCount) * 100) : 0,
)

onMounted(async () => {
  try {
    status.value = await OnboardingService.status()
  } catch {
    // Sin el estado no se muestra nada: la guía nunca debe estorbar el panel.
  }
})
</script>

<style scoped>
</style>
