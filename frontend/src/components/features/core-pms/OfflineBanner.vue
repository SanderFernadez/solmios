<template>
  <div v-if="!isOnline" class="bg-coral text-white px-6 py-2 text-center text-xs font-bold flex items-center justify-center gap-2">
    <span>📡</span>
    <span>Sin conexión — mostrando datos en caché. Las acciones de escritura están pausadas.</span>
  </div>
</template>

<script setup lang="ts">
import { ref, onMounted, onUnmounted } from 'vue'

const isOnline = ref(navigator.onLine)

function onOnline() { isOnline.value = true }
function onOffline() { isOnline.value = false }

onMounted(() => {
  window.addEventListener('online', onOnline)
  window.addEventListener('offline', onOffline)
})

onUnmounted(() => {
  window.removeEventListener('online', onOnline)
  window.removeEventListener('offline', onOffline)
})
</script>

<style scoped></style>
