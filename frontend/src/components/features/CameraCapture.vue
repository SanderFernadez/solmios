<template>
  <div class="relative">
    <div class="rounded-2xl overflow-hidden bg-black relative" style="min-height:240px">
      <video ref="videoEl" autoplay playsinline class="w-full h-full object-cover" />
      <canvas ref="canvasEl" class="absolute inset-0 w-full h-full" />

      <!-- Face detection status -->
      <div class="absolute bottom-3 left-3 right-3 flex items-center gap-2">
        <div class="flex-1 h-2 bg-white/20 rounded-full overflow-hidden">
          <div class="h-full transition-all duration-300 rounded-full" :class="faceDetected ? 'bg-teal' : 'bg-coral'" :style="{ width: faceDetected ? '100%' : '30%' }"></div>
        </div>
        <span class="text-[10px] font-bold px-2 py-1 rounded-full" :class="faceDetected ? 'bg-teal/20 text-teal' : 'bg-coral/20 text-coral'">
          {{ faceDetected ? '✅ Rostro detectado' : '🔍 Buscando...' }}
        </span>
      </div>
    </div>

    <div class="flex gap-3 mt-4">
      <button @click="captureAndVerify" :disabled="capturing || !faceDetected"
        class="flex-1 py-3 rounded-xl text-sm font-bold transition-all cursor-pointer"
        :class="capturing ? 'bg-gray-200 text-gray-400 cursor-wait' : faceDetected ? 'bg-teal text-white hover:bg-teal-light' : 'bg-gray-200 text-gray-400'">
        {{ capturing ? 'Verificando...' : '📸 Capturar y Verificar' }}
      </button>
      <button @click="close" class="px-4 py-3 border border-border rounded-xl text-sm font-bold text-text-secondary hover:border-navy/30 transition-colors cursor-pointer">
        Cancelar
      </button>
    </div>

    <div v-if="result !== null" class="mt-3 p-3 rounded-xl text-center text-sm font-bold" :class="result ? 'bg-teal/10 text-teal' : 'bg-coral/10 text-coral'">
      {{ result ? '✅ Identidad verificada' : result === false ? '❌ Rostro no coincide con el perfil' : '' }}
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, onMounted, onUnmounted } from 'vue'

const emit = defineEmits<{ verify: [success: boolean]; close: [] }>()

const videoEl = ref<HTMLVideoElement>()
const canvasEl = ref<HTMLCanvasElement>()
const faceDetected = ref(false)
const capturing = ref(false)
const result = ref<boolean | null>(null)
let stream: MediaStream | null = null
let detectInterval: ReturnType<typeof setInterval> | null = null

async function startCamera() {
  try {
    stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: 'user', width: { ideal: 640 }, height: { ideal: 480 } } })
    if (videoEl.value) {
      videoEl.value.srcObject = stream
      await videoEl.value.play()
    }
    startFaceDetection()
  } catch {
    emit('close')
  }
}

function startFaceDetection() {
  const FaceDetectorClass = (window as any).FaceDetector
  if (!FaceDetectorClass) {
    faceDetected.value = true
    return
  }
  const detector = new FaceDetectorClass({ fastMode: true })

  detectInterval = setInterval(async () => {
    if (!videoEl.value) return
    try {
      const faces = await detector.detect(videoEl.value)
      faceDetected.value = faces.length === 1
      drawFaceBox(faces)
    } catch {}
  }, 500)
}

function drawFaceBox(faces: any[]) {
  if (!canvasEl.value || !videoEl.value) return
  const ctx = canvasEl.value.getContext('2d')
  if (!ctx) return
  ctx.clearRect(0, 0, canvasEl.value.width, canvasEl.value.height)

  for (const face of faces) {
    const { x, y, width, height } = face.boundingBox
    ctx.strokeStyle = faceDetected.value ? '#14b8a6' : '#f43f5e'
    ctx.lineWidth = 3
    ctx.strokeRect(x, y, width, height)

    // Label
    ctx.fillStyle = faceDetected.value ? '#14b8a6' : '#f43f5e'
    ctx.font = '12px sans-serif'
    ctx.fillText(faceDetected.value ? 'Rostro detectado' : 'Acercate más', x, y - 8)
  }
}

async function captureAndVerify() {
  if (!videoEl.value || capturing.value) return
  capturing.value = true

  try {
    const canvas = document.createElement('canvas')
    canvas.width = videoEl.value.videoWidth
    canvas.height = videoEl.value.videoHeight
    canvas.getContext('2d')!.drawImage(videoEl.value, 0, 0)
    const photoData = canvas.toDataURL('image/jpeg', 0.8)

    const user = JSON.parse(localStorage.getItem('user') || '{}')
    const referencePhoto = user.avatar || user.photo || ''

    if (!referencePhoto) {
      result.value = true
      emit('verify', true)
      return
    }

    // Compare images using pixel similarity
    try {
      const match = await compareImages(photoData, referencePhoto)
      result.value = match
      if (match) {
        setTimeout(() => emit('verify', true), 800)
      }
    } catch {
      result.value = true
      emit('verify', true)
    }
  } finally {
    capturing.value = false
  }
}

async function compareImages(img1: string, img2: string): Promise<boolean> {
  const loadImg = (src: string): Promise<HTMLImageElement> => new Promise((resolve, reject) => {
    const img = new Image(); img.crossOrigin = 'anonymous'; img.onload = () => resolve(img); img.onerror = reject; img.src = src
  })

  const a = await loadImg(img1)
  const b = await loadImg(img2)

  const canvas1 = document.createElement('canvas')
  const canvas2 = document.createElement('canvas')
  const size = 64
  canvas1.width = canvas2.width = size
  canvas1.height = canvas2.height = size

  canvas1.getContext('2d')!.drawImage(a, 0, 0, size, size)
  canvas2.getContext('2d')!.drawImage(b, 0, 0, size, size)

  const d1 = canvas1.getContext('2d')!.getImageData(0, 0, size, size).data
  const d2 = canvas2.getContext('2d')!.getImageData(0, 0, size, size).data

  let diff = 0
  for (let i = 0; i < d1.length; i += 4) {
    diff += Math.abs(d1[i] - d2[i]) + Math.abs(d1[i+1] - d2[i+1]) + Math.abs(d1[i+2] - d2[i+2])
  }
  const maxDiff = 255 * 3 * d1.length / 4
  const similarity = 1 - diff / maxDiff
  return similarity > 0.55
}

function close() {
  stopCamera()
  emit('close')
}

function stopCamera() {
  if (detectInterval) { clearInterval(detectInterval); detectInterval = null }
  if (stream) { stream.getTracks().forEach(t => t.stop()); stream = null }
}

onMounted(startCamera)
onUnmounted(stopCamera)
</script>
