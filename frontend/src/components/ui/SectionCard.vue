<template>
  <div class="rounded-[20px] border-2 border-navy bg-white shadow-(--shadow-card) overflow-hidden">
    <!-- Header de sección oscuro (mismo look en todo el sistema) -->
    <div v-if="title || $slots.header || $slots.actions"
      class="flex items-center justify-between gap-3 flex-wrap bg-navy px-4 sm:px-5 py-4">
      <slot name="header">
        <div class="min-w-0">
          <h2 class="text-base sm:text-lg font-black text-white truncate">{{ title }}</h2>
          <p v-if="subtitle" class="text-[11px] text-white/60 mt-0.5 truncate">{{ subtitle }}</p>
        </div>
      </slot>
      <div v-if="$slots.actions" class="flex items-center gap-2 flex-wrap">
        <slot name="actions" />
      </div>
    </div>

    <!-- Cuerpo -->
    <div :class="bodyClass">
      <slot />
    </div>
  </div>
</template>

<script setup lang="ts">
withDefaults(defineProps<{
  title?: string
  subtitle?: string
  bodyClass?: string
}>(), { bodyClass: 'p-4 sm:p-5' })
</script>
