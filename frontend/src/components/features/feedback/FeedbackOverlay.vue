<script setup lang="ts">
import { onMounted, onUnmounted, watch } from 'vue'
import { useRoute } from 'vue-router'
import { useFeedbackStore } from '@/stores/feedback.store'
import FeedbackPin from './FeedbackPin.vue'

const route = useRoute()
const store = useFeedbackStore()

watch(() => route.fullPath, (newRoute) => {
  if (store.isFeedbackMode) {
    store.activeRoute = newRoute
    store.loadPins(newRoute)
  }
})

async function captureScreenshot(): Promise<string | null> {
  try {
    const { default: html2canvas } = await import('html2canvas')
    const target = document.querySelector('[data-feedback-content]') || document.getElementById('app') || document.body
    const canvas = await html2canvas(target as HTMLElement, {
      useCORS: true,
      allowTaint: true,
      scale: 1,
      logging: false,
      backgroundColor: '#ffffff',
    })
    return canvas.toDataURL('image/png')
  } catch {
    return null
  }
}

function handleOverlayClick(e: MouseEvent) {
  if (!store.isFeedbackMode) return
  if ((e.target as HTMLElement).closest('.fb-pin, .fb-modal-overlay')) return

  // Mostrar modal INMEDIATAMENTE
  store.captureClick(e.clientX, e.clientY)

  // Capturar screenshot en background (no bloquea el modal)
  captureScreenshot().then(screenshot => {
    if (screenshot) {
      store.setScreenshot(screenshot)
    }
  })
}

function handleKeydown(e: KeyboardEvent) {
  if (e.key === 'Escape' && store.isFeedbackMode) {
    store.disableFeedbackMode()
  }
}

onMounted(() => {
  document.addEventListener('keydown', handleKeydown)
})

onUnmounted(() => {
  document.removeEventListener('keydown', handleKeydown)
})
</script>

<template>
  <Transition name="fb-overlay">
    <div
      v-if="store.isFeedbackMode"
      class="fixed inset-0 z-[9998] cursor-crosshair"
      @click="handleOverlayClick"
      @contextmenu.prevent
    >
      <div class="absolute inset-0 bg-navy/10 dark:bg-black/20 pointer-events-none" />

      <FeedbackPin
        v-for="(pin, idx) in store.routePins"
        :key="pin.id"
        :pin="pin"
        :index="idx"
        :selected="store.selectedPin?.id === pin.id"
        @select="store.selectedPin = pin"
      />
    </div>
  </Transition>
</template>

<style scoped>
.fb-overlay-enter-active,
.fb-overlay-leave-active {
  transition: opacity 0.2s ease;
}
.fb-overlay-enter-from,
.fb-overlay-leave-to {
  opacity: 0;
}
</style>
