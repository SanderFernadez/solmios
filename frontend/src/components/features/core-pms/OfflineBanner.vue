<template>
  <div v-if="!isOnline" class="bg-coral text-white px-6 py-2 text-center text-xs font-bold flex items-center justify-center gap-2">
    <span>📡</span>
    <span>Sin conexión — las acciones de escritura (check-in, checkout, reservas) están pausadas hasta volver online.</span>
  </div>
</template>

<script setup lang="ts">
import { useOnline } from '@/composables/useOnline'

const { isOnline } = useOnline()
</script>

<style scoped></style>
