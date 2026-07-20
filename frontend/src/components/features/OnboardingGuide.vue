<template>
  <!-- Primeros pasos. Un hotel recién creado entra a un panel con todo en cero
       y ninguna pista de por dónde empezar; esta guía es esa pista. Desaparece
       sola cuando lo obligatorio ya está hecho.

       Cada paso se puede desplegar para leer CÓMO se hace: la versión anterior
       mostraba una línea y un botón "Empezar" que dejaba al usuario en una
       pantalla vacía, sin saber qué apretar. -->
  <div v-if="show" class="rounded-[20px] border-2 border-navy bg-white overflow-hidden mb-6">
    <div class="bg-navy px-5 py-4 flex items-center justify-between gap-3">
      <div class="min-w-0">
        <h3 class="text-base font-black text-white">Configurá tu hotel</h3>
        <p class="text-[11px] text-white/60 mt-0.5">
          {{ status!.doneCount }} de {{ status!.totalCount }} pasos · tocá un paso para ver cómo se hace
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
      <div v-for="(s, i) in status!.steps" :key="s.key" :class="s.done ? 'bg-surface/60' : ''">
        <!-- Cabecera del paso: toda la fila abre y cierra la explicación. -->
        <div
          class="flex items-center gap-3 px-5 py-3.5"
          :class="s.done ? '' : 'cursor-pointer hover:bg-surface/40'"
          @click="!s.done && toggle(s.key)"
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

          <span
            v-if="!s.done"
            class="shrink-0 w-4 h-4 text-text-muted transition-transform duration-200"
            :class="open === s.key ? 'rotate-180' : ''"
            v-html="ICON_CHEVRON"
          ></span>
        </div>

        <!-- Explicación. Es el motivo de la guía: decir qué apretar y qué se
             pierde si el paso queda sin hacer. -->
        <div v-if="!s.done && open === s.key" class="px-5 pb-4 pl-14">
          <div class="rounded-xl bg-surface/70 border border-border p-3.5">
            <p class="text-[11px] font-black uppercase tracking-wide text-navy mb-1">Cómo se hace</p>
            <p class="text-xs text-text-secondary leading-relaxed">{{ s.how }}</p>

            <p v-if="s.impact" class="text-[11px] text-text-muted leading-relaxed mt-2.5 flex gap-1.5">
              <span class="w-3.5 h-3.5 shrink-0 mt-px text-warning" v-html="ICON_WARN"></span>
              <span>{{ s.impact }}</span>
            </p>

            <router-link
              :to="s.route"
              class="mt-3 inline-flex items-center gap-1.5 px-3.5 py-2 rounded-full text-[11px] font-bold transition-colors"
              :class="s.required ? 'bg-navy text-white hover:bg-navy-light' : 'border border-border text-text-secondary hover:border-navy/30'"
            >
              {{ s.cta || 'Empezar' }}
              <span class="w-3 h-3" v-html="ICON_ARROW"></span>
            </router-link>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, onMounted, watch } from 'vue'
import { OnboardingService, type OnboardingStatus } from '@/services/Onboarding.service'

const status = ref<OnboardingStatus | null>(null)
const dismissed = ref(false)
/** Paso desplegado. Uno solo por vez: la guía no puede tapar el dashboard. */
const open = ref<string | null>(null)

const ICON_CHEVRON = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" class="w-full h-full"><path stroke-linecap="round" stroke-linejoin="round" d="m19.5 8.25-7.5 7.5-7.5-7.5"/></svg>'
const ICON_ARROW = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3" class="w-full h-full"><path stroke-linecap="round" stroke-linejoin="round" d="M17 8l4 4m0 0l-4 4m4-4H3"/></svg>'
const ICON_WARN = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" class="w-full h-full"><path stroke-linecap="round" stroke-linejoin="round" d="M12 9v3.75m-9.303 3.376c-.866 1.5.217 3.374 1.948 3.374h14.71c1.73 0 2.813-1.874 1.948-3.374L13.949 3.378c-.866-1.5-3.032-1.5-3.898 0L2.697 16.126ZM12 15.75h.007v.008H12v-.008Z"/></svg>'

const show = computed(() => !dismissed.value && status.value !== null && !status.value.completed)
const progress = computed(() =>
  status.value ? Math.round((status.value.doneCount / status.value.totalCount) * 100) : 0,
)

function toggle(key: string) {
  open.value = open.value === key ? null : key
}

// Arranca abierto el primer paso pendiente: si hay que tocar para ver la
// explicación, la mayoría no toca y la guía sigue sin explicar nada.
watch(status, (s) => {
  if (s && open.value === null) open.value = s.steps.find((x) => !x.done)?.key ?? null
})

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
