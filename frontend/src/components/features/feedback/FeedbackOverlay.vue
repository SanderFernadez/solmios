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

function drawPinMarker(canvas: HTMLCanvasElement, x: number, y: number): void {
  const ctx = canvas.getContext('2d')!
  const size = 24

  // Círculo exterior (borde blanco)
  ctx.beginPath()
  ctx.arc(x, y, size + 2, 0, Math.PI * 2)
  ctx.fillStyle = 'white'
  ctx.fill()

  // Círculo interior (rojo)
  ctx.beginPath()
  ctx.arc(x, y, size, 0, Math.PI * 2)
  ctx.fillStyle = '#ef4444'
  ctx.fill()

  // Cruz blanca
  ctx.strokeStyle = 'white'
  ctx.lineWidth = 3
  ctx.lineCap = 'round'

  // Línea horizontal
  ctx.beginPath()
  ctx.moveTo(x - 10, y)
  ctx.lineTo(x + 10, y)
  ctx.stroke()

  // Línea vertical
  ctx.beginPath()
  ctx.moveTo(x, y - 10)
  ctx.lineTo(x, y + 10)
  ctx.stroke()

  // Punto central
  ctx.beginPath()
  ctx.arc(x, y, 3, 0, Math.PI * 2)
  ctx.fillStyle = 'white'
  ctx.fill()
}

async function captureScreenshot(clickX?: number, clickY?: number): Promise<string | null> {
  // Método 1: getDisplayMedia (nativo del browser)
  try {
    const stream = await navigator.mediaDevices.getDisplayMedia({
      video: { displaySurface: 'browser' } as any,
      preferCurrentTab: true,
    } as any)
    const track = stream.getVideoTracks()[0]
    const imageCapture = new ImageCapture(track)
    const bitmap = await imageCapture.grabFrame()
    track.stop()

    const canvas = document.createElement('canvas')
    canvas.width = bitmap.width
    canvas.height = bitmap.height
    const ctx = canvas.getContext('2d')!
    ctx.drawImage(bitmap, 0, 0)

    // Dibujar pin en la posición del click
    if (clickX !== undefined && clickY !== undefined) {
      const scaleX = bitmap.width / window.innerWidth
      const scaleY = bitmap.height / window.innerHeight
      drawPinMarker(canvas, clickX * scaleX, clickY * scaleY)
    }

    return canvas.toDataURL('image/png')
  } catch {
    // Método 2: fallback a html2canvas
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

      // Dibujar pin en la posición del click
      if (clickX !== undefined && clickY !== undefined) {
        const scaleX = canvas.width / window.innerWidth
        const scaleY = canvas.height / window.innerHeight
        drawPinMarker(canvas, clickX * scaleX, clickY * scaleY)
      }

      return canvas.toDataURL('image/png')
    } catch {
      return null
    }
  }
}

async function handleOverlayClick(e: MouseEvent) {
  if (!store.isFeedbackMode) return
  if ((e.target as HTMLElement).closest('.fb-pin, .fb-modal-overlay')) return

  const x = e.clientX
  const y = e.clientY

  // 1. OCULTAR overlay para que no salga en la foto
  store.isFeedbackMode = false

  // 2. Esperar un frame para que el overlay desaparezca del DOM
  await new Promise(r => requestAnimationFrame(() => requestAnimationFrame(r)))

  // 3. Capturar screenshot SIN el overlay, CON el pin marcado
  const screenshot = await captureScreenshot(x, y)

  // 4. REACTIVAR feedback mode y mostrar modal
  store.isFeedbackMode = true
  if (screenshot) {
    store.setScreenshot(screenshot)
  }
  store.captureClick(x, y)
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
      v-if="store.isFeedbackMode && !store.isModalOpen"
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
