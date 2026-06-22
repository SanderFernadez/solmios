<template>
  <div class="card p-4 text-center">
    <div class="text-2xl font-black" :class="$attrs.class || 'text-navy'">{{ value }}</div>
    <div class="text-[10px] text-text-muted uppercase font-bold mt-0.5">{{ label }}</div>
  </div>
</template>

<script setup lang="ts">
defineProps<{ label: string; value: string | number }>()
</script>
