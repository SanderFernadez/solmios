<script setup lang="ts">
// SkeletonLoader.vue — Placeholder de carga reutilizable.
// Variantes: 'list' (filas con avatar+líneas), 'card' (tarjetas), 'table' (filas de tabla), 'text' (líneas sueltas).
// Uso: <SkeletonLoader v-if="loading" variant="table" :rows="6" />
import { computed } from 'vue'

const props = withDefaults(defineProps<{
  rows?: number
  variant?: 'list' | 'card' | 'table' | 'text'
}>(), {
  rows: 4,
  variant: 'list',
})

const items = computed(() => Array.from({ length: Math.max(1, props.rows) }))
</script>

<template>
  <div class="animate-pulse" role="status" aria-busy="true" aria-label="Cargando">
    <!-- LIST: avatar circular + dos líneas -->
    <div v-if="variant === 'list'" class="space-y-3">
      <div
        v-for="(_, i) in items"
        :key="i"
        class="flex items-center gap-4 rounded-xl border border-border bg-white p-4"
      >
        <div class="h-11 w-11 shrink-0 rounded-full bg-surface"></div>
        <div class="flex-1 space-y-2.5">
          <div class="h-3.5 w-1/3 rounded bg-surface"></div>
          <div class="h-3 w-2/3 rounded bg-surface"></div>
        </div>
        <div class="h-7 w-16 shrink-0 rounded-lg bg-surface"></div>
      </div>
    </div>

    <!-- CARD: grilla de tarjetas -->
    <div v-else-if="variant === 'card'" class="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
      <div
        v-for="(_, i) in items"
        :key="i"
        class="rounded-2xl border border-border bg-white p-5"
      >
        <div class="mb-4 h-24 w-full rounded-xl bg-surface"></div>
        <div class="space-y-2.5">
          <div class="h-4 w-2/3 rounded bg-surface"></div>
          <div class="h-3 w-1/2 rounded bg-surface"></div>
          <div class="h-3 w-full rounded bg-surface"></div>
        </div>
      </div>
    </div>

    <!-- TABLE: filas planas con header -->
    <div v-else-if="variant === 'table'" class="overflow-hidden rounded-xl border border-border bg-white">
      <div class="flex items-center gap-4 border-b border-border bg-surface/60 px-4 py-3">
        <div class="h-3 w-1/5 rounded bg-surface"></div>
        <div class="h-3 w-1/4 rounded bg-surface"></div>
        <div class="h-3 w-1/6 rounded bg-surface"></div>
        <div class="ml-auto h-3 w-16 rounded bg-surface"></div>
      </div>
      <div
        v-for="(_, i) in items"
        :key="i"
        class="flex items-center gap-4 border-b border-border px-4 py-3.5 last:border-b-0"
      >
        <div class="h-3.5 w-1/5 rounded bg-surface"></div>
        <div class="h-3.5 w-1/4 rounded bg-surface"></div>
        <div class="h-3.5 w-1/6 rounded bg-surface"></div>
        <div class="ml-auto h-6 w-16 rounded-lg bg-surface"></div>
      </div>
    </div>

    <!-- TEXT: líneas sueltas -->
    <div v-else class="space-y-2.5">
      <div
        v-for="(_, i) in items"
        :key="i"
        class="h-3.5 rounded bg-surface"
        :class="i === items.length - 1 ? 'w-2/3' : 'w-full'"
      ></div>
    </div>
    <span class="sr-only">Cargando…</span>
  </div>
</template>

<style scoped></style>
