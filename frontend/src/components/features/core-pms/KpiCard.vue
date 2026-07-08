<template>
  <div class="card p-4">
    <div class="flex items-center gap-3">
      <div v-if="icon" class="w-10 h-10 rounded-xl flex items-center justify-center shrink-0" :class="iconBg || 'bg-navy/10'">
        <span class="w-5 h-5" :class="iconColor || 'text-navy'" v-html="icon"></span>
      </div>
      <div class="min-w-0">
        <div class="text-xl font-black leading-none truncate" :class="$attrs.class || 'text-navy'">{{ value }}</div>
        <div class="text-[10px] text-text-muted uppercase font-bold tracking-wide mt-1 truncate">{{ label }}</div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
defineProps<{ label: string; value: string | number; icon?: string; iconBg?: string; iconColor?: string }>()
</script>

<style scoped></style>
