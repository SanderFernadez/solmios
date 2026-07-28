<template>
  <!--
    FaqBlock — acordeón de preguntas. Items del `config.items`. Si no hay items → no renderiza.
    El orquestador también OMITE el bloque si items=[] (v-if allá) — el JSON-LD FAQPage depende
    de que haya al menos 1 item.
  -->
  <section v-if="items.length > 0" class="max-w-3xl mx-auto px-6 py-16">
    <header v-if="title" class="mb-8 text-center">
      <p class="text-[11px] uppercase tracking-[0.18em] font-bold text-cyan mb-2">Dudas frecuentes</p>
      <h2 class="text-3xl sm:text-4xl font-black text-navy tracking-tight">{{ title }}</h2>
    </header>

    <div class="space-y-3">
      <div
        v-for="(item, i) in items"
        :key="i"
        class="bg-white rounded-xl border border-border overflow-hidden"
      >
        <button
          type="button"
          class="w-full flex items-center justify-between gap-4 text-left px-5 py-4 cursor-pointer"
          :aria-expanded="openIdx === i"
          @click="toggle(i)"
        >
          <span class="font-bold text-navy text-sm sm:text-base">{{ item.question }}</span>
          <span
            class="text-cyan text-xl font-light flex-shrink-0 transition-transform"
            :class="{ 'rotate-45': openIdx === i }"
            aria-hidden="true"
          >+</span>
        </button>
        <div
          v-show="openIdx === i"
          class="px-5 pb-4 text-sm text-text-secondary leading-relaxed"
        >
          {{ item.answer }}
        </div>
      </div>
    </div>
  </section>
</template>

<script setup lang="ts">
import { computed, ref } from 'vue'
import type { FaqItem, LandingBlock, PublicHotelInfo, PublicHotelMedia } from '@/types'

const props = defineProps<{
  block: LandingBlock
  hotel: PublicHotelInfo
  media: PublicHotelMedia | null
}>()

const cfg = computed(() => (props.block.config ?? {}) as Record<string, unknown>)

const title = computed(() => {
  const t = typeof cfg.value.title === 'string' ? cfg.value.title.trim() : ''
  return t || 'Preguntas frecuentes'
})

// Defensive parse: el backend debería validar shape, pero acá no confiamos en runtime.
const items = computed<FaqItem[]>(() => {
  const raw = cfg.value.items
  if (!Array.isArray(raw)) return []
  return raw
    .filter((it): it is FaqItem =>
      typeof it === 'object' && it !== null &&
      typeof (it as FaqItem).question === 'string' && typeof (it as FaqItem).answer === 'string',
    )
    .map((it) => ({ question: (it as FaqItem).question.trim(), answer: (it as FaqItem).answer.trim() }))
    .filter((it) => it.question && it.answer)
})

const openIdx = ref<number | null>(0)
function toggle(i: number) {
  openIdx.value = openIdx.value === i ? null : i
}
</script>
