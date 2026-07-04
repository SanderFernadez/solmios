<script setup lang="ts">
import { onMounted, onUnmounted, watch, ref } from 'vue'
import { useRoute } from 'vue-router'
import { useFeedbackStore } from '@/stores/feedback.store'
import FeedbackPin from './FeedbackPin.vue'

const route = useRoute()
const store = useFeedbackStore()
const capturing = ref(false)

watch(() => route.fullPath, (newRoute) => {
  if (store.isFeedbackMode) {
    store.activeRoute = newRoute
    store.loadPins(newRoute)
  }
})

async function captureScreenshot(): Promise<string | null> {
  try {
    // Intentar con getDisplayMedia (nativo del browser)
    const stream = await navigator.mediaDevices.getDisplayMedia({
      video: { displaySurface: 'browser' } as any,
    })
    const track = stream.getVideoTracks()[0]
    const imageCapture = new ImageCapture(track)
    const bitmap = await imageCapture.grabFrame()
    track.stop()

    const canvas = document.createElement('canvas')
    canvas.width = bitmap.width
    canvas.height = bitmap.height
    const ctx = canvas.getContext('2d')!
    ctx.drawImage(bitmap, 0, 0)

    return canvas.toDataURL('image/png')
  } catch {
    // Fallback: intentar con html2canvas
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
}

async function handleOverlayClick(e: MouseEvent) {
  if (!store.isFeedbackMode) return
  if ((e.target as HTMLElement).closest('.fb-pin, .fb-modal-overlay')) return

  capturing.value = true
  await new Promise(r => requestAnimationFrame(() => requestAnimationFrame(r)))

  const screenshot = await captureScreenshot()
  if (screenshot) {
    store.setScreenshot(screenshot)
  }

  capturing.value = false
  store.captureClick(e.clientX, e.clientY)
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
      v-if="store.isFeedbackMode && !capturing"
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
