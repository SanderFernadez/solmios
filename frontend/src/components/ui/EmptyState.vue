<script setup lang="ts">
// EmptyState.vue — Estado vacío reutilizable (listas sin datos, búsquedas sin resultados).
// Props: icon (svg html o emoji), title (obligatorio), message.
// Slot #action para el CTA (botón "Crear", "Reintentar", etc.).
// Uso:
//   <EmptyState v-if="!items.length" title="Sin reservas" message="Todavía no hay reservas para hoy.">
//     <template #action><button ...>Nueva reserva</button></template>
//   </EmptyState>
defineProps<{
  icon?: string
  title: string
  message?: string
}>()
</script>

<template>
  <div class="flex flex-col items-center justify-center px-6 py-14 text-center">
    <div
      v-if="icon"
      class="mb-4 flex h-16 w-16 items-center justify-center rounded-2xl bg-surface text-3xl text-text-muted"
      v-html="icon"
    ></div>
    <h3 class="text-base font-black text-navy">{{ title }}</h3>
    <p v-if="message" class="mt-1.5 max-w-sm text-sm text-text-muted">{{ message }}</p>
    <div v-if="$slots.action" class="mt-5">
      <slot name="action" />
    </div>
  </div>
</template>

<style scoped></style>
